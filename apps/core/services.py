from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.models import (
    CustomerNode,
    CustomerPayment,
    CustomerPaymentAllocation,
    CustomerPrice,
    InventoryAllocation,
    InventoryLot,
    OperationalExpense,
    Partner,
    PartnerPayout,
    Sale,
    SaleLine,
    SmartSplitAllocation,
)


MONEY_QUANT = Decimal("0.01")
GRAM_QUANT = Decimal("0.001")


def money(value):
    return Decimal(value or 0).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def grams(value):
    return Decimal(value or 0).quantize(GRAM_QUANT, rounding=ROUND_HALF_UP)


def sum_amount(queryset, field="amount"):
    value = queryset.aggregate(total=Sum(field))["total"]
    return money(value or Decimal("0.00"))


def sum_grams(queryset, field="remaining_grams"):
    value = queryset.aggregate(total=Sum(field))["total"]
    return grams(value or Decimal("0.000"))


def sale_paid_amount(sale):
    return sum_amount(sale.payment_allocations.all())


def sale_outstanding_amount(sale):
    return money(sale.total_amount - sale_paid_amount(sale))


def customer_outstanding_amount(customer):
    total_sales = sum_amount(
        Sale.objects.filter(customer=customer).exclude(status=Sale.Status.CANCELLED),
        "total_amount",
    )
    total_paid = sum_amount(CustomerPaymentAllocation.objects.filter(sale__customer=customer))
    return money(total_sales - total_paid)


def _unit_price_for_line(customer, product, portion, explicit_price=None):
    if explicit_price is not None:
        return money(explicit_price)

    price = (
        CustomerPrice.objects.filter(
            customer=customer,
            product=product,
            portion=portion,
            active=True,
        )
        .order_by("-created_at")
        .first()
    )
    if not price:
        raise ValidationError(
            {
                "unit_price": (
                    f"No hay precio activo para {customer.name}, "
                    f"{product.sku} y la unidad {portion.name}."
                )
            }
        )
    return money(price.unit_price)


def _allocate_inventory_for_sale_line(sale_line):
    remaining = sale_line.total_grams
    cogs_total = Decimal("0.00")

    lots = (
        InventoryLot.objects.select_for_update()
        .filter(product=sale_line.product, remaining_grams__gt=0)
        .order_by("purchased_at", "created_at")
    )

    for lot in lots:
        if remaining <= 0:
            break

        allocated_grams = min(remaining, lot.remaining_grams)
        unit_cost = (lot.total_cost / lot.total_grams).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        cost_amount = money(allocated_grams * unit_cost)

        InventoryAllocation.objects.create(
            sale_line=sale_line,
            lot=lot,
            grams=allocated_grams,
            unit_cost_snapshot=unit_cost,
            cost_amount=cost_amount,
        )

        lot.remaining_grams = grams(lot.remaining_grams - allocated_grams)
        lot.save(update_fields=["remaining_grams", "updated_at"])

        remaining = grams(remaining - allocated_grams)
        cogs_total += cost_amount

    if remaining > 0:
        raise ValidationError(
            {
                "inventory": (
                    f"Existencia insuficiente para {sale_line.product.sku}. "
                    f"Faltan {remaining} piezas."
                )
            }
        )

    return money(cogs_total)


@transaction.atomic
def create_sale(
    *,
    customer,
    lines,
    delivered_at=None,
    due_at=None,
    notes="",
    channel=Sale.Channel.WHOLESALE,
    sold_by_partner=None,
):
    if not lines:
        raise ValidationError({"lines": "La venta debe incluir al menos un producto."})

    sale = Sale.objects.create(
        customer=customer,
        channel=channel,
        sold_by_partner=sold_by_partner,
        status=Sale.Status.DELIVERED,
        delivered_at=delivered_at or timezone.now(),
        due_at=due_at,
        notes=notes,
    )

    total_amount = Decimal("0.00")
    total_cogs = Decimal("0.00")

    for item in lines:
        product = item["product"]
        portion = item["portion"]
        portions_qty = item["portions_qty"]

        if portion.product_id != product.id:
            raise ValidationError({"portion": "La unidad debe pertenecer al producto vendido."})

        unit_price = _unit_price_for_line(
            customer=customer,
            product=product,
            portion=portion,
            explicit_price=item.get("unit_price"),
        )
        total_grams = grams(Decimal(portions_qty) * Decimal(portion.pieces_per_portion) * product.grams_per_piece)
        line_total = money(Decimal(portions_qty) * unit_price)

        sale_line = SaleLine.objects.create(
            sale=sale,
            product=product,
            portion=portion,
            portions_qty=portions_qty,
            pieces_per_portion_snapshot=portion.pieces_per_portion,
            grams_per_piece_snapshot=product.grams_per_piece,
            total_grams=total_grams,
            unit_price=unit_price,
            line_total=line_total,
            cogs_amount=Decimal("0.00"),
        )

        cogs_amount = _allocate_inventory_for_sale_line(sale_line)
        sale_line.cogs_amount = cogs_amount
        sale_line.save(update_fields=["cogs_amount", "updated_at"])

        total_amount += line_total
        total_cogs += cogs_amount

    sale.total_amount = money(total_amount)
    sale.total_cogs = money(total_cogs)
    sale.save(update_fields=["total_amount", "total_cogs", "updated_at"])
    return sale


def _direct_sale_customer_for_partner(partner):
    customer, created = CustomerNode.objects.get_or_create(
        name=f"Venta directa - Socio {partner.code}",
        defaults={
            "kind": CustomerNode.Kind.DIRECT,
            "contact_name": partner.name,
            "active": True,
        },
    )
    changed_fields = []

    if customer.kind != CustomerNode.Kind.DIRECT:
        customer.kind = CustomerNode.Kind.DIRECT
        changed_fields.append("kind")
    if customer.contact_name != partner.name:
        customer.contact_name = partner.name
        changed_fields.append("contact_name")
    if not customer.active:
        customer.active = True
        changed_fields.append("active")

    if not created and changed_fields:
        customer.save(update_fields=[*changed_fields, "updated_at"])

    return customer


@transaction.atomic
def create_direct_sale(*, partner, product, portion, portions_qty, unit_price, method, reference="", received_at=None, notes=""):
    if not partner:
        raise ValidationError({"partner": "Tu usuario no tiene una sesión de socio vinculada."})

    received_at = received_at or timezone.now()
    customer = _direct_sale_customer_for_partner(partner)
    sale = create_sale(
        customer=customer,
        lines=[
            {
                "product": product,
                "portion": portion,
                "portions_qty": portions_qty,
                "unit_price": unit_price,
            }
        ],
        delivered_at=received_at,
        notes=notes,
        channel=Sale.Channel.DIRECT,
        sold_by_partner=partner,
    )
    payment = record_customer_payment(
        customer=customer,
        amount=sale.total_amount,
        received_at=received_at,
        method=method,
        reference=reference,
        sale_allocations=[{"sale": sale, "amount": sale.total_amount}],
    )
    sale.refresh_from_db()
    return sale, payment


def _payment_allocations_from_request(customer, amount, requested_allocations):
    if requested_allocations:
        allocation_total = money(sum(Decimal(item["amount"]) for item in requested_allocations))
        if allocation_total != amount:
            raise ValidationError({"sale_allocations": "Las aplicaciones deben sumar exactamente el monto del cobro."})

        allocations = []
        for item in requested_allocations:
            sale = Sale.objects.select_for_update().get(id=item["sale"].id)
            if sale.customer_id != customer.id:
                raise ValidationError({"sale_allocations": "La venta no pertenece al cliente del cobro."})
            if sale.status == Sale.Status.CANCELLED:
                raise ValidationError({"sale_allocations": "No se puede aplicar un cobro a una venta cancelada."})

            item_amount = money(item["amount"])
            if item_amount > sale_outstanding_amount(sale):
                raise ValidationError({"sale_allocations": "La aplicacion supera el saldo pendiente de la venta."})

            allocations.append((sale, item_amount))
        return allocations

    remaining = amount
    allocations = []
    sales = (
        Sale.objects.select_for_update()
        .filter(customer=customer)
        .exclude(status=Sale.Status.CANCELLED)
        .order_by("delivered_at", "created_at")
    )
    for sale in sales:
        if remaining <= 0:
            break
        outstanding = sale_outstanding_amount(sale)
        if outstanding <= 0:
            continue
        item_amount = min(remaining, outstanding)
        allocations.append((sale, item_amount))
        remaining = money(remaining - item_amount)

    if remaining > 0:
        raise ValidationError({"amount": "El cobro excede las cuentas por cobrar del cliente."})

    return allocations


def _refresh_sale_status(sale):
    paid = sale_paid_amount(sale)
    if paid >= sale.total_amount:
        sale.status = Sale.Status.PAID
    elif paid > 0:
        sale.status = Sale.Status.PARTIAL
    else:
        sale.status = Sale.Status.DELIVERED
    sale.save(update_fields=["status", "updated_at"])


def _outstanding_expenses():
    expenses = (
        OperationalExpense.objects.select_for_update()
        .filter(voided=False)
        .order_by("incurred_at", "created_at")
    )
    for expense in expenses:
        allocated = sum_amount(
            SmartSplitAllocation.objects.filter(
                type=SmartSplitAllocation.Type.EXPENSE_REIMBURSEMENT,
                expense=expense,
            )
        )
        pending = money(expense.amount - allocated)
        if pending > 0:
            yield expense, pending


def _outstanding_inventory_reserves():
    sales = (
        Sale.objects.select_for_update()
        .exclude(status__in=[Sale.Status.DRAFT, Sale.Status.CANCELLED])
        .prefetch_related("lines")
        .order_by("delivered_at", "created_at")
    )
    for sale in sales:
        if sale.total_amount <= 0:
            continue

        paid = sale_paid_amount(sale)
        if paid <= 0:
            continue

        fully_paid = paid >= sale.total_amount
        paid_ratio = min(paid / sale.total_amount, Decimal("1.00"))

        for line in sale.lines.all():
            eligible_cogs = line.cogs_amount if fully_paid else money(line.cogs_amount * paid_ratio)
            reserved = sum_amount(
                SmartSplitAllocation.objects.filter(
                    type=SmartSplitAllocation.Type.INVENTORY_RESERVE,
                    sale_line=line,
                )
            )
            pending = money(eligible_cogs - reserved)
            if pending > 0:
                yield line, pending


def _active_partners_for_profit():
    partners = list(Partner.objects.filter(active=True).order_by("code"))
    if len(partners) != 2:
        raise ValidationError({"partners": "El reparto de utilidad requiere exactamente 2 socios activos."})
    return partners


def _allocate_profit(payment, amount):
    if amount <= 0:
        return

    partners = _active_partners_for_profit()
    first_share = money(amount / Decimal("2"))
    shares = [first_share, money(amount - first_share)]

    for partner, share in zip(partners, shares, strict=True):
        if share <= 0:
            continue
        SmartSplitAllocation.objects.create(
            payment=payment,
            type=SmartSplitAllocation.Type.PARTNER_PROFIT,
            partner=partner,
            amount=share,
        )


def apply_smart_split(payment):
    remaining = money(payment.amount)

    for expense, pending in _outstanding_expenses():
        if remaining <= 0:
            return

        allocation_amount = min(remaining, pending)
        SmartSplitAllocation.objects.create(
            payment=payment,
            type=SmartSplitAllocation.Type.EXPENSE_REIMBURSEMENT,
            partner=expense.paid_by_partner,
            expense=expense,
            amount=allocation_amount,
        )
        remaining = money(remaining - allocation_amount)

    for sale_line, pending in _outstanding_inventory_reserves():
        if remaining <= 0:
            return

        allocation_amount = min(remaining, pending)
        SmartSplitAllocation.objects.create(
            payment=payment,
            type=SmartSplitAllocation.Type.INVENTORY_RESERVE,
            sale_line=sale_line,
            amount=allocation_amount,
        )
        remaining = money(remaining - allocation_amount)

    _allocate_profit(payment, remaining)


@transaction.atomic
def record_customer_payment(*, customer, amount, received_at, method, reference="", sale_allocations=None):
    amount = money(amount)
    if amount <= 0:
        raise ValidationError({"amount": "El monto del cobro debe ser mayor a cero."})

    allocations = _payment_allocations_from_request(customer, amount, sale_allocations or [])

    payment = CustomerPayment.objects.create(
        customer=customer,
        amount=amount,
        received_at=received_at,
        method=method,
        reference=reference,
    )

    touched_sales = []
    for sale, allocation_amount in allocations:
        CustomerPaymentAllocation.objects.create(
            payment=payment,
            sale=sale,
            amount=allocation_amount,
        )
        touched_sales.append(sale)

    for sale in touched_sales:
        _refresh_sale_status(sale)

    apply_smart_split(payment)
    return payment


def financial_snapshot():
    partner_rows = []
    for partner in Partner.objects.filter(active=True).order_by("code"):
        reimbursed = sum_amount(
            SmartSplitAllocation.objects.filter(
                type=SmartSplitAllocation.Type.EXPENSE_REIMBURSEMENT,
                partner=partner,
            )
        )
        profit = sum_amount(
            SmartSplitAllocation.objects.filter(
                type=SmartSplitAllocation.Type.PARTNER_PROFIT,
                partner=partner,
            )
        )
        payouts_total = sum_amount(PartnerPayout.objects.filter(partner=partner))
        reimbursement_payouts = sum_amount(
            PartnerPayout.objects.filter(partner=partner, reason=PartnerPayout.Reason.REIMBURSEMENT)
        )
        profit_payouts = sum_amount(PartnerPayout.objects.filter(partner=partner, reason=PartnerPayout.Reason.PROFIT))
        expense_total = sum_amount(OperationalExpense.objects.filter(paid_by_partner=partner, voided=False))

        partner_rows.append(
            {
                "partner_id": str(partner.id),
                "code": partner.code,
                "name": partner.name,
                "expenses_paid": expense_total,
                "reimbursements_allocated": reimbursed,
                "reimbursements_pending_to_allocate": money(expense_total - reimbursed),
                "reimbursements_available_to_payout": money(reimbursed - reimbursement_payouts),
                "profit_allocated": profit,
                "profit_available_to_payout": money(profit - profit_payouts),
                "total_payouts": payouts_total,
                "net_partner_balance": money(reimbursed + profit - payouts_total),
            }
        )

    pending_expenses = money(sum(row["reimbursements_pending_to_allocate"] for row in partner_rows))
    reimbursement_due = money(sum(row["reimbursements_available_to_payout"] for row in partner_rows))
    profit_available = money(sum(row["profit_available_to_payout"] for row in partner_rows))
    inventory_reserve = sum_amount(
        SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)
    )
    cash_in = sum_amount(CustomerPayment.objects.all())
    cash_out = sum_amount(PartnerPayout.objects.all())
    accounts_receivable = money(
        sum(customer_outstanding_amount(sale_customer) for sale_customer in _customers_with_sales())
    )

    return {
        "cash_on_hand": money(cash_in - cash_out),
        "accounts_receivable": accounts_receivable,
        "pending_expense_reimbursements": pending_expenses,
        "partner_reimbursements_available": reimbursement_due,
        "inventory_reserve_allocated": inventory_reserve,
        "net_profit_available": profit_available,
        "partners": partner_rows,
    }


def _customers_with_sales():
    customer_ids = Sale.objects.exclude(status=Sale.Status.CANCELLED).values_list("customer_id", flat=True).distinct()

    return CustomerNode.objects.filter(id__in=customer_ids)
