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
    PortionSize,
    Product,
    Sale,
    SaleLine,
    SmartSplitAllocation,
    Supplier,
)


MONEY_QUANT = Decimal("0.01")
GRAM_QUANT = Decimal("0.001")
DEFAULT_PORTION_NAME = "Unidad"


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


def normalized_portion_name(value):
    return (value or "").strip().lower().replace(" ", "").replace("-", "")


def recovery_price_for_portion(portion):
    configured_price = money(getattr(portion, "recovery_price", Decimal("0.00")))
    if configured_price > 0:
        return configured_price
    return money(0)


def recovery_amount_for_sale_line(sale_line):
    recovery_amount = money(getattr(sale_line, "recovery_amount", Decimal("0.00")))
    if recovery_amount > 0:
        return recovery_amount

    recovery_unit = money(getattr(sale_line, "recovery_unit_price_snapshot", Decimal("0.00")))
    if recovery_unit <= 0 and sale_line.product_id:
        recovery_unit = money(getattr(sale_line.product, "recovery_price", Decimal("0.00")))
    if recovery_unit <= 0 and sale_line.portion_id:
        recovery_unit = recovery_price_for_portion(sale_line.portion)

    return money(Decimal(sale_line.portions_qty) * recovery_unit)


def ensure_default_sale_unit(product):
    PortionModel = product.portions.model
    portion, _ = PortionModel.objects.get_or_create(
        product=product,
        name=DEFAULT_PORTION_NAME,
        defaults={
            "pieces_per_portion": 1,
            "recovery_price": Decimal("0.00"),
            "active": True,
        },
    )

    if not portion.active:
        portion.active = True
        portion.save(update_fields=["active", "updated_at"])

    return portion


def primary_sale_portion_for_product(product):
    portions = list(PortionSize.objects.filter(product=product, active=True).order_by("name"))
    for portion in portions:
        if normalized_portion_name(portion.name) == normalized_portion_name(DEFAULT_PORTION_NAME):
            return portion
    return portions[0] if portions else ensure_default_sale_unit(product)


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
    supplier=None,
):
    if not lines:
        raise ValidationError({"lines": "La venta debe incluir al menos un producto."})

    sale = Sale.objects.create(
        customer=customer,
        supplier=supplier,
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

        recovery_unit_price = money(product.recovery_price)
        if recovery_unit_price <= 0:
            raise ValidationError({"recovery_price": f"Configura el precio a recuperar de {product.name} antes de vender."})

        unit_price = _unit_price_for_line(
            customer=customer,
            product=product,
            portion=portion,
            explicit_price=item.get("unit_price"),
        )
        total_grams = grams(Decimal(portions_qty) * Decimal(portion.pieces_per_portion) * product.grams_per_piece)
        line_total = money(Decimal(portions_qty) * unit_price)
        recovery_amount = money(Decimal(portions_qty) * recovery_unit_price)

        sale_line = SaleLine.objects.create(
            sale=sale,
            product=product,
            portion=portion,
            portions_qty=portions_qty,
            pieces_per_portion_snapshot=portion.pieces_per_portion,
            grams_per_piece_snapshot=product.grams_per_piece,
            total_grams=total_grams,
            unit_price=unit_price,
            recovery_unit_price_snapshot=recovery_unit_price,
            line_total=line_total,
            recovery_amount=recovery_amount,
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


def _wholesale_customer_for_supplier(supplier):
    customer, created = CustomerNode.objects.get_or_create(
        name=f"Proveedor - {supplier.name}",
        defaults={
            "kind": CustomerNode.Kind.WHOLESALE,
            "contact_name": supplier.name,
            "phone": supplier.phone,
            "active": True,
        },
    )
    changed_fields = []

    if customer.kind != CustomerNode.Kind.WHOLESALE:
        customer.kind = CustomerNode.Kind.WHOLESALE
        changed_fields.append("kind")
    if customer.contact_name != supplier.name:
        customer.contact_name = supplier.name
        changed_fields.append("contact_name")
    if customer.phone != supplier.phone:
        customer.phone = supplier.phone
        changed_fields.append("phone")
    if not customer.active:
        customer.active = True
        changed_fields.append("active")

    if not created and changed_fields:
        customer.save(update_fields=[*changed_fields, "updated_at"])

    return customer


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


@transaction.atomic
def create_supplier_sale(
    *,
    partner,
    supplier,
    product,
    portion,
    quantity,
    unit_price=None,
    paid_amount=Decimal("0.00"),
    method="cash",
    reference="",
    delivered_at=None,
    notes="",
):
    if not supplier.active:
        raise ValidationError({"supplier": "El proveedor seleccionado no está activo."})
    sale_partner = supplier.partner or partner
    if not sale_partner:
        raise ValidationError({"partner": "La venta necesita un socio vinculado al proveedor o a tu sesión."})

    delivered_at = delivered_at or timezone.now()
    customer = _wholesale_customer_for_supplier(supplier)
    price = money(unit_price if unit_price is not None else product.recovery_price)

    sale = create_sale(
        customer=customer,
        supplier=supplier,
        lines=[
            {
                "product": product,
                "portion": portion,
                "portions_qty": quantity,
                "unit_price": price,
            }
        ],
        delivered_at=delivered_at,
        notes=notes,
        channel=Sale.Channel.WHOLESALE,
        sold_by_partner=sale_partner,
    )

    payment = None
    paid_amount = money(paid_amount)
    if paid_amount > sale.total_amount:
        raise ValidationError({"paid_amount": "El cobro no puede superar el total de la venta."})
    if paid_amount > 0:
        payment = record_customer_payment(
            customer=customer,
            amount=paid_amount,
            received_at=delivered_at,
            method=method,
            reference=reference,
            sale_allocations=[{"sale": sale, "amount": paid_amount}],
        )
        sale.refresh_from_db()

    return sale, payment


def _refresh_sales_statuses(sales):
    seen = set()
    for sale in sales:
        if not sale or sale.id in seen:
            continue
        seen.add(sale.id)
        _refresh_sale_status(sale)


def _delete_or_reduce_payments_for_sale(sale):
    payment_rows = list(
        CustomerPaymentAllocation.objects.select_related("payment")
        .filter(sale=sale)
        .order_by("created_at")
    )
    impacted_sales = []

    for allocation in payment_rows:
        payment = allocation.payment
        removed_amount = money(allocation.amount)

        SmartSplitAllocation.objects.filter(payment=payment).delete()
        allocation.delete()

        remaining_allocations = list(payment.sale_allocations.select_related("sale"))
        if not remaining_allocations:
            payment.delete()
            continue

        next_amount = money(payment.amount - removed_amount)
        if next_amount <= 0:
            payment.delete()
            continue

        payment.amount = next_amount
        payment.save(update_fields=["amount", "updated_at"])
        impacted_sales.extend(item.sale for item in remaining_allocations)
        apply_smart_split(payment)

    _refresh_sales_statuses(impacted_sales)


def _restore_inventory_for_sale(sale):
    allocations = InventoryAllocation.objects.select_related("lot").filter(sale_line__sale=sale)
    for allocation in allocations:
        lot = allocation.lot
        lot.remaining_grams = grams(min(lot.total_grams, lot.remaining_grams + allocation.grams))
        lot.save(update_fields=["remaining_grams", "updated_at"])


def _delete_empty_auto_customer(customer):
    if not customer:
        return

    is_auto_customer = customer.name.startswith("Proveedor - ") or customer.name.startswith("Venta directa - Socio ")
    if not is_auto_customer:
        return

    has_sales = Sale.objects.filter(customer=customer).exists()
    has_payments = CustomerPayment.objects.filter(customer=customer).exists()
    if not has_sales and not has_payments:
        customer.delete()


@transaction.atomic
def hard_delete_sale(sale_or_id):
    sale_id = getattr(sale_or_id, "id", sale_or_id)
    sale = (
        Sale.objects.select_for_update()
        .select_related("customer")
        .prefetch_related("lines")
        .get(pk=sale_id)
    )
    customer = sale.customer
    line_ids = list(sale.lines.values_list("id", flat=True))

    _restore_inventory_for_sale(sale)
    SmartSplitAllocation.objects.filter(sale_line_id__in=line_ids).delete()
    _delete_or_reduce_payments_for_sale(sale)
    sale.delete()
    _delete_empty_auto_customer(customer)


@transaction.atomic
def hard_delete_supplier(supplier_or_id):
    supplier_id = getattr(supplier_or_id, "id", supplier_or_id)
    supplier = Supplier.objects.select_for_update().get(pk=supplier_id)
    auto_customer = CustomerNode.objects.filter(name=f"Proveedor - {supplier.name}").first()
    sale_ids = list(Sale.objects.filter(supplier=supplier).values_list("id", flat=True))

    for sale_id in sale_ids:
        hard_delete_sale(sale_id)

    supplier.delete()
    _delete_empty_auto_customer(auto_customer)


@transaction.atomic
def hard_delete_product(product_or_id):
    product_id = getattr(product_or_id, "id", product_or_id)
    product = Product.objects.select_for_update().get(pk=product_id)
    sale_ids = list(SaleLine.objects.filter(product=product).values_list("sale_id", flat=True).distinct())

    for sale_id in sale_ids:
        hard_delete_sale(sale_id)

    CustomerPrice.objects.filter(product=product).delete()
    InventoryLot.objects.filter(product=product).delete()
    PortionSize.objects.filter(product=product).delete()
    product.delete()


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
                raise ValidationError({"sale_allocations": "La aplicación supera el saldo pendiente de la venta."})

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
            recovery_amount = recovery_amount_for_sale_line(line)
            eligible_cogs = recovery_amount if fully_paid else money(recovery_amount * paid_ratio)
            reserved = sum_amount(
                SmartSplitAllocation.objects.filter(
                    type=SmartSplitAllocation.Type.INVENTORY_RESERVE,
                    sale_line=line,
                )
            )
            pending = money(eligible_cogs - reserved)
            if pending > 0:
                yield line, pending


def _sale_owner_partner(sale):
    if sale.supplier_id and sale.supplier and sale.supplier.partner_id:
        return sale.supplier.partner
    return sale.sold_by_partner


def _pending_recovery_for_sale_line(sale_line):
    reserved = sum_amount(
        SmartSplitAllocation.objects.filter(
            type=SmartSplitAllocation.Type.INVENTORY_RESERVE,
            sale_line=sale_line,
        )
    )
    return money(recovery_amount_for_sale_line(sale_line) - reserved)


def _allocate_profit_to_partner(payment, partner, amount):
    if amount <= 0:
        return

    if not partner:
        raise ValidationError({"partner": "La utilidad necesita un socio responsable de la venta."})

    SmartSplitAllocation.objects.create(
        payment=payment,
        type=SmartSplitAllocation.Type.PARTNER_PROFIT,
        partner=partner,
        amount=amount,
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

    payment_allocations = (
        payment.sale_allocations.select_related("sale", "sale__supplier", "sale__supplier__partner", "sale__sold_by_partner")
        .prefetch_related("sale__lines")
        .order_by("created_at")
    )
    for payment_allocation in payment_allocations:
        if remaining <= 0:
            return

        sale_cash = min(remaining, money(payment_allocation.amount))
        sale = payment_allocation.sale

        for sale_line in sale.lines.all():
            if sale_cash <= 0:
                break

            pending_recovery = _pending_recovery_for_sale_line(sale_line)
            if pending_recovery <= 0:
                continue

            allocation_amount = min(sale_cash, pending_recovery)
            SmartSplitAllocation.objects.create(
                payment=payment,
                type=SmartSplitAllocation.Type.INVENTORY_RESERVE,
                sale_line=sale_line,
                amount=allocation_amount,
            )
            sale_cash = money(sale_cash - allocation_amount)
            remaining = money(remaining - allocation_amount)

        if sale_cash > 0:
            _allocate_profit_to_partner(payment, _sale_owner_partner(sale), sale_cash)
            remaining = money(remaining - sale_cash)

    if remaining > 0:
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
