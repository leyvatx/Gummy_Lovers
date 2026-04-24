from decimal import Decimal

from rest_framework import serializers

from apps.core import services
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


class BaseModelSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ["id", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = [
            "id",
            "code",
            "user",
            "name",
            "initial_capital",
            "ownership_percent",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PortionSizeSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PortionSize
        fields = [
            "id",
            "product",
            "product_sku",
            "product_name",
            "name",
            "pieces_per_portion",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "product_sku", "product_name", "created_at", "updated_at"]


class ProductSerializer(serializers.ModelSerializer):
    portions = PortionSizeSerializer(many=True, read_only=True)
    available_grams = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "name",
            "grams_per_piece",
            "active",
            "available_grams",
            "portions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "available_grams", "portions", "created_at", "updated_at"]

    def get_available_grams(self, obj):
        return services.sum_grams(obj.lots.all(), "remaining_grams")


class CustomerPriceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    portion_name = serializers.CharField(source="portion.name", read_only=True)

    class Meta:
        model = CustomerPrice
        fields = [
            "id",
            "customer",
            "customer_name",
            "product",
            "product_sku",
            "portion",
            "portion_name",
            "unit_price",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer_name", "product_sku", "portion_name", "created_at", "updated_at"]

    def validate(self, attrs):
        product = attrs.get("product", getattr(self.instance, "product", None))
        portion = attrs.get("portion", getattr(self.instance, "portion", None))
        if product and portion and portion.product_id != product.id:
            raise serializers.ValidationError({"portion": "La unidad debe pertenecer al producto seleccionado."})
        return attrs


class CustomerNodeSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.SerializerMethodField()

    class Meta:
        model = CustomerNode
        fields = [
            "id",
            "name",
            "kind",
            "contact_name",
            "phone",
            "address",
            "credit_limit",
            "active",
            "outstanding_balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "outstanding_balance", "created_at", "updated_at"]

    def get_outstanding_balance(self, obj):
        return services.customer_outstanding_amount(obj)


class InventoryLotSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    total_grams = serializers.DecimalField(max_digits=14, decimal_places=3, required=False)
    remaining_grams = serializers.DecimalField(max_digits=14, decimal_places=3, required=False)
    total_cost = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)

    class Meta:
        model = InventoryLot
        fields = [
            "id",
            "product",
            "product_sku",
            "supplier",
            "supplier_name",
            "lot_code",
            "boxes_qty",
            "bags_per_box",
            "kg_per_bag",
            "box_cost",
            "total_grams",
            "remaining_grams",
            "total_cost",
            "paid_by_partner",
            "purchased_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "product_sku", "supplier_name", "created_at", "updated_at"]

    def validate(self, attrs):
        data = {**getattr(self.instance, "__dict__", {}), **attrs}
        total_grams = data.get("total_grams")
        remaining_grams = data.get("remaining_grams")
        if total_grams is not None and remaining_grams is not None and remaining_grams > total_grams:
            raise serializers.ValidationError({"remaining_grams": "La existencia no puede superar el total."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        partner = getattr(getattr(request, "user", None), "partner", None)
        if partner and not validated_data.get("paid_by_partner"):
            validated_data["paid_by_partner"] = partner

        boxes_qty = Decimal(validated_data["boxes_qty"])
        bags_per_box = Decimal(validated_data["bags_per_box"])
        kg_per_bag = validated_data["kg_per_bag"]
        box_cost = validated_data["box_cost"]

        total_grams = validated_data.setdefault("total_grams", services.grams(boxes_qty * bags_per_box * kg_per_bag * 1000))
        validated_data.setdefault("remaining_grams", total_grams)
        validated_data.setdefault("total_cost", services.money(boxes_qty * box_cost))
        return super().create(validated_data)


class InventoryAllocationSerializer(serializers.ModelSerializer):
    lot_code = serializers.CharField(source="lot.lot_code", read_only=True)

    class Meta:
        model = InventoryAllocation
        fields = ["id", "lot", "lot_code", "grams", "unit_cost_snapshot", "cost_amount", "created_at"]
        read_only_fields = fields


class SaleLineSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    portion_name = serializers.CharField(source="portion.name", read_only=True)
    inventory_allocations = InventoryAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = SaleLine
        fields = [
            "id",
            "product",
            "product_sku",
            "portion",
            "portion_name",
            "portions_qty",
            "pieces_per_portion_snapshot",
            "grams_per_piece_snapshot",
            "total_grams",
            "unit_price",
            "line_total",
            "cogs_amount",
            "inventory_allocations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SaleLineInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True))
    portion = serializers.PrimaryKeyRelatedField(queryset=PortionSize.objects.filter(active=True))
    portions_qty = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"), required=False)

    def validate(self, attrs):
        if attrs["portion"].product_id != attrs["product"].id:
            raise serializers.ValidationError({"portion": "La unidad debe pertenecer al producto vendido."})
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    sold_by_partner_name = serializers.CharField(source="sold_by_partner.name", read_only=True)
    lines = SaleLineSerializer(many=True, read_only=True)
    items = SaleLineInputSerializer(many=True, write_only=True, required=True)
    paid_amount = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "customer",
            "customer_name",
            "channel",
            "sold_by_partner",
            "sold_by_partner_name",
            "status",
            "delivered_at",
            "due_at",
            "total_amount",
            "total_cogs",
            "paid_amount",
            "outstanding_balance",
            "notes",
            "lines",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "channel",
            "sold_by_partner",
            "sold_by_partner_name",
            "status",
            "total_amount",
            "total_cogs",
            "paid_amount",
            "outstanding_balance",
            "lines",
            "created_at",
            "updated_at",
        ]

    def get_paid_amount(self, obj):
        return services.sale_paid_amount(obj)

    def get_outstanding_balance(self, obj):
        return services.sale_outstanding_amount(obj)

    def create(self, validated_data):
        items = validated_data.pop("items")
        request = self.context.get("request")
        partner = getattr(getattr(request, "user", None), "partner", None)
        return services.create_sale(
            lines=items,
            sold_by_partner=partner,
            channel=Sale.Channel.WHOLESALE,
            **validated_data,
        )


class OperationalExpenseSerializer(serializers.ModelSerializer):
    paid_by_partner_name = serializers.CharField(source="paid_by_partner.name", read_only=True)

    class Meta:
        model = OperationalExpense
        fields = [
            "id",
            "paid_by_partner",
            "paid_by_partner_name",
            "category",
            "description",
            "amount",
            "incurred_at",
            "voided",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "paid_by_partner", "paid_by_partner_name", "created_at", "updated_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        partner = getattr(getattr(request, "user", None), "partner", None)
        if not partner:
            raise serializers.ValidationError({"paid_by_partner": "Tu usuario no tiene una sesión de socio vinculada."})
        return OperationalExpense.objects.create(paid_by_partner=partner, **validated_data)


class CustomerPaymentAllocationSerializer(serializers.ModelSerializer):
    sale_status = serializers.CharField(source="sale.status", read_only=True)

    class Meta:
        model = CustomerPaymentAllocation
        fields = ["id", "sale", "sale_status", "amount", "created_at"]
        read_only_fields = fields


class CustomerPaymentAllocationInputSerializer(serializers.Serializer):
    sale = serializers.PrimaryKeyRelatedField(queryset=Sale.objects.exclude(status=Sale.Status.CANCELLED))
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class SmartSplitAllocationSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)

    class Meta:
        model = SmartSplitAllocation
        fields = [
            "id",
            "payment",
            "type",
            "partner",
            "partner_name",
            "expense",
            "sale_line",
            "amount",
            "created_at",
        ]
        read_only_fields = fields


class CustomerPaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    sale_allocations = CustomerPaymentAllocationSerializer(many=True, read_only=True)
    smart_split_allocations = SmartSplitAllocationSerializer(many=True, read_only=True)
    apply_to_sales = CustomerPaymentAllocationInputSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = CustomerPayment
        fields = [
            "id",
            "customer",
            "customer_name",
            "amount",
            "received_at",
            "method",
            "reference",
            "apply_to_sales",
            "sale_allocations",
            "smart_split_allocations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_name",
            "sale_allocations",
            "smart_split_allocations",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        apply_to_sales = validated_data.pop("apply_to_sales", [])
        return services.record_customer_payment(sale_allocations=apply_to_sales, **validated_data)


class DirectSaleSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True))
    portion = serializers.PrimaryKeyRelatedField(queryset=PortionSize.objects.filter(active=True))
    portions_qty = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.CharField(max_length=40)
    reference = serializers.CharField(max_length=120, allow_blank=True, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate(self, attrs):
        if attrs["portion"].product_id != attrs["product"].id:
            raise serializers.ValidationError({"portion": "La unidad debe pertenecer al producto vendido."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        partner = getattr(getattr(request, "user", None), "partner", None)
        if not partner:
            raise serializers.ValidationError({"partner": "Tu usuario no tiene una sesión de socio vinculada."})

        sale, payment = services.create_direct_sale(
            partner=partner,
            product=validated_data["product"],
            portion=validated_data["portion"],
            portions_qty=validated_data["portions_qty"],
            unit_price=validated_data["unit_price"],
            method=validated_data["method"],
            reference=validated_data.get("reference", ""),
            notes=validated_data.get("notes", ""),
        )
        return {"sale": sale, "payment": payment}

    def to_representation(self, instance):
        return {
            "sale": SaleSerializer(instance["sale"], context=self.context).data,
            "payment": CustomerPaymentSerializer(instance["payment"], context=self.context).data,
        }


class PartnerPayoutSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)

    class Meta:
        model = PartnerPayout
        fields = [
            "id",
            "partner",
            "partner_name",
            "amount",
            "paid_at",
            "reason",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "partner_name", "created_at", "updated_at"]
