from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import services
from apps.core.auth_serializers import AuthenticatedUserSerializer, LoginSerializer
from apps.core.models import (
    CustomerNode,
    CustomerPayment,
    CustomerPrice,
    InventoryLot,
    OperationalExpense,
    Partner,
    PartnerPayout,
    PortionSize,
    Product,
    Sale,
    Supplier,
)
from apps.core.serializers import (
    CustomerNodeSerializer,
    CustomerPaymentSerializer,
    CustomerPriceSerializer,
    DirectSaleSerializer,
    InventoryLotSerializer,
    OperationalExpenseSerializer,
    PartnerPayoutSerializer,
    PartnerSerializer,
    PortionSizeSerializer,
    ProductSerializer,
    SaleSerializer,
    SupplierSerializer,
    SupplierSaleSerializer,
)


class ActiveFilterMixin:
    def filter_active(self, queryset):
        active = self.request.query_params.get("active")
        if active is None or not hasattr(queryset.model, "active"):
            return queryset
        if active.lower() in {"1", "true", "yes"}:
            return queryset.filter(active=True)
        if active.lower() in {"0", "false", "no"}:
            return queryset.filter(active=False)
        return queryset


class PartnerViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = Partner.objects.select_related("user").all()
    serializer_class = PartnerSerializer

    def get_queryset(self):
        return self.filter_active(super().get_queryset())


class SupplierViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.select_related("partner").all()
    serializer_class = SupplierSerializer

    def get_queryset(self):
        return self.filter_active(super().get_queryset())

    def destroy(self, request, *args, **kwargs):
        supplier_id = kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        try:
            services.hard_delete_supplier(supplier_id)
        except Supplier.DoesNotExist:
            return Response({"detail": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        try:
            services.hard_delete_supplier(pk)
        except Supplier.DoesNotExist:
            return Response({"detail": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = Product.objects.prefetch_related("portions", "lots").all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        return self.filter_active(super().get_queryset())

    def destroy(self, request, *args, **kwargs):
        product_id = kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        try:
            services.hard_delete_product(product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        try:
            services.hard_delete_product(pk)
        except Product.DoesNotExist:
            return Response({"detail": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PortionSizeViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = PortionSize.objects.select_related("product").all()
    serializer_class = PortionSizeSerializer

    def get_queryset(self):
        queryset = self.filter_active(super().get_queryset())
        product_id = self.request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset


class CustomerNodeViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = CustomerNode.objects.all()
    serializer_class = CustomerNodeSerializer

    def get_queryset(self):
        queryset = self.filter_active(super().get_queryset())
        kind = self.request.query_params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset

    @action(detail=False, methods=["get"])
    def balances(self, request):
        customers = self.get_queryset().filter(kind=CustomerNode.Kind.WHOLESALE, active=True)
        data = [
            {
                "id": str(customer.id),
                "name": customer.name,
                "contact_name": customer.contact_name,
                "phone": customer.phone,
                "credit_limit": customer.credit_limit,
                "outstanding_balance": services.customer_outstanding_amount(customer),
            }
            for customer in customers
        ]
        return Response(data)


class CustomerPriceViewSet(ActiveFilterMixin, viewsets.ModelViewSet):
    queryset = CustomerPrice.objects.select_related("customer", "product", "portion").all()
    serializer_class = CustomerPriceSerializer

    def get_queryset(self):
        queryset = self.filter_active(super().get_queryset())
        customer_id = self.request.query_params.get("customer")
        product_id = self.request.query_params.get("product")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset


class InventoryLotViewSet(viewsets.ModelViewSet):
    queryset = InventoryLot.objects.select_related("product", "supplier", "paid_by_partner").all()
    serializer_class = InventoryLotSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get("product")
        in_stock = self.request.query_params.get("in_stock")
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if in_stock and in_stock.lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(remaining_grams__gt=0)
        return queryset


class SaleViewSet(viewsets.ModelViewSet):
    queryset = (
        Sale.objects.select_related("customer", "supplier", "sold_by_partner")
        .prefetch_related("lines", "lines__inventory_allocations", "payment_allocations")
        .all()
    )
    serializer_class = SaleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        customer_id = self.request.query_params.get("customer")
        status_filter = self.request.query_params.get("status")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            queryset = queryset.exclude(status=Sale.Status.CANCELLED)
        return queryset

    def destroy(self, request, *args, **kwargs):
        sale_id = kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        try:
            services.hard_delete_sale(sale_id)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            services.hard_delete_sale(pk)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SupplierDeactivateAPIView(APIView):
    def post(self, request, pk):
        try:
            services.hard_delete_supplier(pk)
        except Supplier.DoesNotExist:
            return Response({"detail": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductDeactivateAPIView(APIView):
    def post(self, request, pk):
        try:
            services.hard_delete_product(pk)
        except Product.DoesNotExist:
            return Response({"detail": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SaleCancelAPIView(APIView):
    def post(self, request, pk):
        try:
            services.hard_delete_sale(pk)
        except Sale.DoesNotExist:
            return Response({"detail": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DirectSaleAPIView(APIView):
    def post(self, request):
        serializer = DirectSaleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SupplierSaleAPIView(APIView):
    def post(self, request):
        serializer = SupplierSaleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OperationalExpenseViewSet(viewsets.ModelViewSet):
    queryset = OperationalExpense.objects.select_related("paid_by_partner").all()
    serializer_class = OperationalExpenseSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        partner_id = self.request.query_params.get("partner")
        include_voided = self.request.query_params.get("include_voided")
        if partner_id:
            queryset = queryset.filter(paid_by_partner_id=partner_id)
        if not include_voided:
            queryset = queryset.filter(voided=False)
        return queryset


class CustomerPaymentViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = (
        CustomerPayment.objects.select_related("customer")
        .prefetch_related("sale_allocations", "smart_split_allocations")
        .all()
    )
    serializer_class = CustomerPaymentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset


class PartnerPayoutViewSet(viewsets.ModelViewSet):
    queryset = PartnerPayout.objects.select_related("partner").all()
    serializer_class = PartnerPayoutSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        partner_id = self.request.query_params.get("partner")
        reason = self.request.query_params.get("reason")
        if partner_id:
            queryset = queryset.filter(partner_id=partner_id)
        if reason:
            queryset = queryset.filter(reason=reason)
        return queryset


class FinancialDashboardAPIView(APIView):
    def get(self, request):
        return Response(services.financial_snapshot(), status=status.HTTP_200_OK)


class LoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user": AuthenticatedUserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutAPIView(APIView):
    def post(self, request):
        if request.auth:
            request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(APIView):
    def get(self, request):
        return Response(AuthenticatedUserSerializer(request.user).data, status=status.HTTP_200_OK)


class AdminProfilesAPIView(APIView):
    def get(self, request):
        allowed_usernames = list(getattr(settings, "ALLOWED_ADMIN_USERS", {}).keys())
        users = get_user_model().objects.filter(username__in=allowed_usernames).order_by("username")
        return Response(AuthenticatedUserSerializer(users, many=True).data, status=status.HTTP_200_OK)
