from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.core import views


router = DefaultRouter()
router.register("partners", views.PartnerViewSet, basename="partner")
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("products", views.ProductViewSet, basename="product")
router.register("portions", views.PortionSizeViewSet, basename="portion")
router.register("customers", views.CustomerNodeViewSet, basename="customer")
router.register("customer-prices", views.CustomerPriceViewSet, basename="customer-price")
router.register("inventory-lots", views.InventoryLotViewSet, basename="inventory-lot")
router.register("sales", views.SaleViewSet, basename="sale")
router.register("expenses", views.OperationalExpenseViewSet, basename="expense")
router.register("payments", views.CustomerPaymentViewSet, basename="payment")
router.register("partner-payouts", views.PartnerPayoutViewSet, basename="partner-payout")

urlpatterns = [
    path("auth/login/", views.LoginAPIView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutAPIView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeAPIView.as_view(), name="auth-me"),
    path("auth/admins/", views.AdminProfilesAPIView.as_view(), name="auth-admins"),
    path("dashboard/financial/", views.FinancialDashboardAPIView.as_view(), name="financial-dashboard"),
    path("sales/direct/", views.DirectSaleAPIView.as_view(), name="direct-sale"),
    path("sales/supplier/", views.SupplierSaleAPIView.as_view(), name="supplier-sale"),
    *router.urls,
]
