import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class FullCleanOnSaveMixin:
    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Partner(FullCleanOnSaveMixin, BaseModel):
    class Code(models.TextChoices):
        A = "A", "Socio A"
        B = "B", "Socio B"

    code = models.CharField(max_length=1, choices=Code.choices, unique=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=120)
    initial_capital = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    ownership_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("50.00"),
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("100.00"))],
    )
    active = models.BooleanField(default=True)

    def clean(self):
        super().clean()
        if self.active and Partner.objects.filter(active=True).exclude(pk=self.pk).count() >= 2:
            raise ValidationError("Solo pueden existir 2 socios activos.")

    def __str__(self):
        return f"{self.code} - {self.name}"

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(condition=Q(initial_capital__gte=0), name="partner_initial_capital_gte_0"),
            models.CheckConstraint(
                condition=Q(ownership_percent__gte=0) & Q(ownership_percent__lte=100),
                name="partner_ownership_0_100",
            ),
        ]


class Supplier(BaseModel):
    name = models.CharField(max_length=160, unique=True)
    partner = models.ForeignKey(
        Partner,
        null=True,
        blank=True,
        related_name="supplier_profiles",
        on_delete=models.SET_NULL,
    )
    phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["active", "name"])]


class Product(BaseModel):
    sku = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160)
    wholesale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    grams_per_piece = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sku} - {self.name}"

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["sku", "active"])]
        constraints = [
            models.CheckConstraint(condition=Q(wholesale_price__gte=0), name="product_wholesale_price_gte_0"),
        ]


class PortionSize(BaseModel):
    product = models.ForeignKey(Product, related_name="portions", on_delete=models.PROTECT)
    name = models.CharField(max_length=40)
    pieces_per_portion = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.sku} {self.name}"

    class Meta:
        ordering = ["product__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["product", "name"],
                condition=Q(active=True),
                name="uniq_active_portion_per_product",
            ),
        ]


class CustomerNode(BaseModel):
    class Kind(models.TextChoices):
        WHOLESALE = "wholesale", "Proveedor"
        DIRECT = "direct", "Venta directa"

    name = models.CharField(max_length=160, unique=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.WHOLESALE, db_index=True)
    contact_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address = models.TextField(blank=True)
    credit_limit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(condition=Q(credit_limit__gte=0), name="customer_credit_limit_gte_0"),
        ]


class CustomerPrice(FullCleanOnSaveMixin, BaseModel):
    customer = models.ForeignKey(CustomerNode, related_name="prices", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    portion = models.ForeignKey(PortionSize, on_delete=models.PROTECT)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    active = models.BooleanField(default=True)

    def clean(self):
        super().clean()
        if self.product_id and self.portion_id and self.portion.product_id != self.product_id:
            raise ValidationError({"portion": "La unidad debe pertenecer al producto seleccionado."})

    def __str__(self):
        return f"{self.customer} / {self.product.sku} / {self.portion.name}"

    class Meta:
        ordering = ["customer__name", "product__name", "portion__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "product", "portion"],
                condition=Q(active=True),
                name="uniq_active_customer_price",
            ),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name="customer_price_unit_gte_0"),
        ]


class InventoryLot(BaseModel):
    product = models.ForeignKey(Product, related_name="lots", on_delete=models.PROTECT)
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.SET_NULL)
    lot_code = models.CharField(max_length=60, unique=True)
    boxes_qty = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    bags_per_box = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    kg_per_bag = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("1.000"),
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    box_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    total_grams = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    remaining_grams = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.000"))],
    )
    total_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    paid_by_partner = models.ForeignKey(Partner, null=True, blank=True, on_delete=models.PROTECT)
    purchased_at = models.DateField()

    def __str__(self):
        return f"{self.lot_code} - {self.product.sku}"

    class Meta:
        ordering = ["purchased_at", "created_at"]
        indexes = [models.Index(fields=["product", "remaining_grams", "purchased_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(total_grams__gt=0), name="lot_total_grams_gt_0"),
            models.CheckConstraint(
                condition=Q(remaining_grams__gte=0) & Q(remaining_grams__lte=F("total_grams")),
                name="lot_remaining_valid",
            ),
            models.CheckConstraint(condition=Q(total_cost__gte=0), name="lot_total_cost_gte_0"),
            models.CheckConstraint(condition=Q(box_cost__gte=0), name="lot_box_cost_gte_0"),
        ]


class Sale(BaseModel):
    class Channel(models.TextChoices):
        WHOLESALE = "wholesale", "Venta a proveedores"
        DIRECT = "direct", "Venta propia"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        DELIVERED = "delivered", "Entregada"
        PARTIAL = "partial", "Pago parcial"
        PAID = "paid", "Pagada"
        CANCELLED = "cancelled", "Cancelada"

    customer = models.ForeignKey(CustomerNode, related_name="sales", on_delete=models.PROTECT)
    supplier = models.ForeignKey(
        Supplier,
        null=True,
        blank=True,
        related_name="sales_received",
        on_delete=models.PROTECT,
    )
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.WHOLESALE, db_index=True)
    sold_by_partner = models.ForeignKey(
        Partner,
        null=True,
        blank=True,
        related_name="sales_made",
        on_delete=models.PROTECT,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    delivered_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    total_cogs = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Venta {self.id} - {self.customer}"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["supplier", "status"]),
            models.Index(fields=["channel", "status"]),
            models.Index(fields=["sold_by_partner", "delivered_at"]),
            models.Index(fields=["delivered_at"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(total_amount__gte=0), name="sale_total_amount_gte_0"),
            models.CheckConstraint(condition=Q(total_cogs__gte=0), name="sale_total_cogs_gte_0"),
        ]


class SaleLine(FullCleanOnSaveMixin, BaseModel):
    sale = models.ForeignKey(Sale, related_name="lines", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    portion = models.ForeignKey(PortionSize, on_delete=models.PROTECT)
    portions_qty = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    pieces_per_portion_snapshot = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    grams_per_piece_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    total_grams = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    line_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cogs_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    def clean(self):
        super().clean()
        if self.product_id and self.portion_id and self.portion.product_id != self.product_id:
            raise ValidationError({"portion": "La unidad debe pertenecer al producto vendido."})

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["sale", "product"])]
        constraints = [
            models.CheckConstraint(condition=Q(total_grams__gt=0), name="sale_line_total_grams_gt_0"),
            models.CheckConstraint(condition=Q(line_total__gte=0), name="sale_line_total_gte_0"),
            models.CheckConstraint(condition=Q(cogs_amount__gte=0), name="sale_line_cogs_gte_0"),
        ]


class InventoryAllocation(FullCleanOnSaveMixin, BaseModel):
    sale_line = models.ForeignKey(SaleLine, related_name="inventory_allocations", on_delete=models.CASCADE)
    lot = models.ForeignKey(InventoryLot, related_name="sale_allocations", on_delete=models.PROTECT)
    grams = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=6,
        validators=[MinValueValidator(Decimal("0.000000"))],
    )
    cost_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    def clean(self):
        super().clean()
        if self.sale_line_id and self.lot_id and self.lot.product_id != self.sale_line.product_id:
            raise ValidationError({"lot": "La entrada de inventario debe pertenecer al producto vendido."})

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["lot", "sale_line"])]
        constraints = [
            models.CheckConstraint(condition=Q(grams__gt=0), name="inventory_alloc_grams_gt_0"),
            models.CheckConstraint(condition=Q(cost_amount__gte=0), name="inventory_alloc_cost_gte_0"),
        ]


class OperationalExpense(BaseModel):
    paid_by_partner = models.ForeignKey(Partner, related_name="expenses_paid", on_delete=models.PROTECT)
    category = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    incurred_at = models.DateField(db_index=True)
    voided = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.category} - {self.amount}"

    class Meta:
        ordering = ["-incurred_at", "-created_at"]
        indexes = [models.Index(fields=["paid_by_partner", "voided"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="expense_amount_gt_0"),
        ]


class CustomerPayment(BaseModel):
    customer = models.ForeignKey(CustomerNode, related_name="payments", on_delete=models.PROTECT)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    received_at = models.DateTimeField(db_index=True)
    method = models.CharField(max_length=40)
    reference = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return f"Cobro {self.amount} - {self.customer}"

    class Meta:
        ordering = ["-received_at", "-created_at"]
        indexes = [models.Index(fields=["customer", "received_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="customer_payment_amount_gt_0"),
        ]


class CustomerPaymentAllocation(FullCleanOnSaveMixin, BaseModel):
    payment = models.ForeignKey(CustomerPayment, related_name="sale_allocations", on_delete=models.CASCADE)
    sale = models.ForeignKey(Sale, related_name="payment_allocations", on_delete=models.PROTECT)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    def clean(self):
        super().clean()
        if self.payment_id and self.sale_id and self.payment.customer_id != self.sale.customer_id:
            raise ValidationError({"sale": "El cobro solo puede aplicarse a ventas del mismo cliente."})

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["payment", "sale"], name="uniq_payment_sale_allocation"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="payment_allocation_amount_gt_0"),
        ]


class SmartSplitAllocation(FullCleanOnSaveMixin, BaseModel):
    class Type(models.TextChoices):
        EXPENSE_REIMBURSEMENT = "expense_reimbursement", "Reembolso de gasto"
        INVENTORY_RESERVE = "inventory_reserve", "Reserva de inventario"
        PARTNER_PROFIT = "partner_profit", "Utilidad de socio"

    payment = models.ForeignKey(CustomerPayment, related_name="smart_split_allocations", on_delete=models.CASCADE)
    type = models.CharField(max_length=40, choices=Type.choices)
    partner = models.ForeignKey(Partner, null=True, blank=True, on_delete=models.PROTECT)
    expense = models.ForeignKey(OperationalExpense, null=True, blank=True, on_delete=models.PROTECT)
    sale_line = models.ForeignKey(SaleLine, null=True, blank=True, on_delete=models.PROTECT)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    def clean(self):
        super().clean()
        errors = {}

        if self.type == self.Type.EXPENSE_REIMBURSEMENT:
            if not self.partner_id:
                errors["partner"] = "El reembolso debe asignarse al socio que pagó el gasto."
            if not self.expense_id:
                errors["expense"] = "El reembolso debe vincularse a un gasto operativo."
            if self.sale_line_id:
                errors["sale_line"] = "Un reembolso de gasto no debe vincularse a una línea de venta."

        if self.type == self.Type.INVENTORY_RESERVE:
            if self.partner_id:
                errors["partner"] = "La reserva de inventario no pertenece a un socio."
            if self.expense_id:
                errors["expense"] = "La reserva de inventario no debe vincularse a un gasto operativo."
            if not self.sale_line_id:
                errors["sale_line"] = "La reserva de inventario debe vincularse al producto vendido."

        if self.type == self.Type.PARTNER_PROFIT:
            if not self.partner_id:
                errors["partner"] = "La utilidad debe asignarse a un socio."
            if self.expense_id:
                errors["expense"] = "La utilidad de socio no debe vincularse a un gasto operativo."
            if self.sale_line_id:
                errors["sale_line"] = "La utilidad de socio no debe vincularse a una línea de venta."

        if errors:
            raise ValidationError(errors)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["payment", "type"]),
            models.Index(fields=["partner", "type"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="smart_split_amount_gt_0"),
            models.CheckConstraint(
                condition=(
                    Q(
                        type="expense_reimbursement",
                        partner__isnull=False,
                        expense__isnull=False,
                        sale_line__isnull=True,
                    )
                    | Q(
                        type="inventory_reserve",
                        partner__isnull=True,
                        expense__isnull=True,
                        sale_line__isnull=False,
                    )
                    | Q(
                        type="partner_profit",
                        partner__isnull=False,
                        expense__isnull=True,
                        sale_line__isnull=True,
                    )
                ),
                name="smart_split_type_shape_valid",
            ),
        ]


class PartnerPayout(BaseModel):
    class Reason(models.TextChoices):
        REIMBURSEMENT = "reimbursement", "Reembolso"
        PROFIT = "profit", "Utilidad"
        CAPITAL_RETURN = "capital_return", "Retorno de capital"

    partner = models.ForeignKey(Partner, related_name="payouts", on_delete=models.PROTECT)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    paid_at = models.DateTimeField(db_index=True)
    reason = models.CharField(max_length=40, choices=Reason.choices)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.partner} - {self.reason} - {self.amount}"

    class Meta:
        ordering = ["-paid_at", "-created_at"]
        indexes = [models.Index(fields=["partner", "reason"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="partner_payout_amount_gt_0"),
        ]
