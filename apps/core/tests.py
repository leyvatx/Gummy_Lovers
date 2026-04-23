from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import services
from apps.core.models import (
    CustomerNode,
    CustomerPayment,
    CustomerPrice,
    InventoryLot,
    OperationalExpense,
    Partner,
    PortionSize,
    Product,
    Sale,
    SmartSplitAllocation,
)


class CoreServiceTests(TestCase):
    def setUp(self):
        self.partner_a = Partner.objects.create(code="A", name="Ana")
        self.partner_b = Partner.objects.create(code="B", name="Beto")
        self.customer = CustomerNode.objects.create(name="Cliente Centro")
        self.product = Product.objects.create(sku="GOM-001", name="Gomita enchilada", grams_per_piece=Decimal("2.5000"))
        self.small = PortionSize.objects.create(product=self.product, name="Chico", pieces_per_portion=6)
        CustomerPrice.objects.create(
            customer=self.customer,
            product=self.product,
            portion=self.small,
            unit_price=Decimal("30.00"),
        )
        InventoryLot.objects.create(
            product=self.product,
            lot_code="L-001",
            boxes_qty=1,
            bags_per_box=1,
            kg_per_bag=Decimal("1.000"),
            box_cost=Decimal("500.00"),
            total_grams=Decimal("1000.000"),
            remaining_grams=Decimal("1000.000"),
            total_cost=Decimal("500.00"),
            paid_by_partner=self.partner_a,
            purchased_at=timezone.localdate(),
        )

    def test_create_sale_allocates_inventory_and_cogs(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[
                {
                    "product": self.product,
                    "portion": self.small,
                    "portions_qty": 10,
                }
            ],
        )

        lot = InventoryLot.objects.get(lot_code="L-001")
        line = sale.lines.get()

        self.assertEqual(sale.status, Sale.Status.DELIVERED)
        self.assertEqual(sale.total_amount, Decimal("300.00"))
        self.assertEqual(line.total_grams, Decimal("150.000"))
        self.assertEqual(lot.remaining_grams, Decimal("850.000"))
        self.assertEqual(line.cogs_amount, Decimal("75.00"))

    def test_payment_smart_split_prioritizes_expense_then_inventory_then_profit(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 10}],
        )
        OperationalExpense.objects.create(
            paid_by_partner=self.partner_a,
            category="Empaque",
            description="Bolsas",
            amount=Decimal("50.00"),
            incurred_at=timezone.localdate(),
        )

        payment = services.record_customer_payment(
            customer=self.customer,
            amount=Decimal("300.00"),
            received_at=timezone.now(),
            method="cash",
            sale_allocations=[{"sale": sale, "amount": Decimal("300.00")}],
        )

        allocations = SmartSplitAllocation.objects.filter(payment=payment)
        self.assertEqual(
            services.sum_amount(allocations.filter(type=SmartSplitAllocation.Type.EXPENSE_REIMBURSEMENT)),
            Decimal("50.00"),
        )
        self.assertEqual(
            services.sum_amount(allocations.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)),
            Decimal("75.00"),
        )
        self.assertEqual(
            services.sum_amount(allocations.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT)),
            Decimal("175.00"),
        )
        self.assertEqual(CustomerPayment.objects.count(), 1)
        sale.refresh_from_db()
        self.assertEqual(sale.status, Sale.Status.PAID)

    def test_direct_sale_uses_session_partner_and_smart_split(self):
        sale, payment = services.create_direct_sale(
            partner=self.partner_a,
            product=self.product,
            portion=self.small,
            portions_qty=4,
            unit_price=Decimal("25.00"),
            method="cash",
        )

        sale.refresh_from_db()

        self.assertEqual(sale.channel, Sale.Channel.DIRECT)
        self.assertEqual(sale.status, Sale.Status.PAID)
        self.assertEqual(sale.sold_by_partner, self.partner_a)
        self.assertEqual(sale.customer.kind, CustomerNode.Kind.DIRECT)
        self.assertEqual(sale.total_amount, Decimal("100.00"))
        self.assertEqual(sale.total_cogs, Decimal("30.00"))
        self.assertEqual(payment.amount, Decimal("100.00"))
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)
            ),
            Decimal("30.00"),
        )
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT)
            ),
            Decimal("70.00"),
        )


class CoreAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_superuser(
            username="efrain.leyva",
            email="efrain@gummylovers.local",
            password="testpass123",
            first_name="Efrain",
            last_name="Leyva",
        )
        self.client.force_authenticate(self.user)
        self.partner_a = Partner.objects.create(code="A", name="Ana")
        self.partner_b = Partner.objects.create(code="B", name="Beto")
        self.customer = CustomerNode.objects.create(name="Cliente Centro")
        self.product = Product.objects.create(sku="GOM-001", name="Gomita enchilada", grams_per_piece=Decimal("2.5000"))
        self.small = PortionSize.objects.create(product=self.product, name="Chico", pieces_per_portion=6)
        CustomerPrice.objects.create(
            customer=self.customer,
            product=self.product,
            portion=self.small,
            unit_price=Decimal("30.00"),
        )
        InventoryLot.objects.create(
            product=self.product,
            lot_code="L-001",
            boxes_qty=1,
            bags_per_box=1,
            kg_per_bag=Decimal("1.000"),
            box_cost=Decimal("500.00"),
            total_grams=Decimal("1000.000"),
            remaining_grams=Decimal("1000.000"),
            total_cost=Decimal("500.00"),
            paid_by_partner=self.partner_a,
            purchased_at=timezone.localdate(),
        )

    def test_sales_endpoint_creates_delivered_sale(self):
        response = self.client.post(
            "/api/sales/",
            {
                "customer": str(self.customer.id),
                "items": [
                    {
                        "product": str(self.product.id),
                        "portion": str(self.small.id),
                        "portions_qty": 10,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], Sale.Status.DELIVERED)
        self.assertEqual(response.data["total_amount"], "300.00")
        self.assertEqual(response.data["total_cogs"], "75.00")

    def test_expense_endpoint_uses_authenticated_partner(self):
        self.partner_a.user = self.user
        self.partner_a.name = "Efrain Leyva"
        self.partner_a.save()

        response = self.client.post(
            "/api/expenses/",
            {
                "category": "Insumos",
                "description": "Bolsas",
                "amount": "120.00",
                "incurred_at": str(timezone.localdate()),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data["paid_by_partner"]), str(self.partner_a.id))

    def test_direct_sale_endpoint_creates_paid_sale_for_authenticated_partner(self):
        self.partner_a.user = self.user
        self.partner_a.name = "Efrain Leyva"
        self.partner_a.save()

        response = self.client.post(
            "/api/sales/direct/",
            {
                "product": str(self.product.id),
                "portion": str(self.small.id),
                "portions_qty": 2,
                "unit_price": "40.00",
                "method": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sale"]["channel"], Sale.Channel.DIRECT)
        self.assertEqual(response.data["sale"]["status"], Sale.Status.PAID)
        self.assertEqual(response.data["sale"]["total_amount"], "80.00")
        self.assertEqual(response.data["payment"]["amount"], "80.00")
        self.assertEqual(response.data["sale"]["sold_by_partner_name"], "Efrain Leyva")

        balances_response = self.client.get("/api/customers/balances/")
        self.assertEqual(balances_response.status_code, 200)
        customer_names = {item["name"] for item in balances_response.data}
        self.assertNotIn("Venta directa - Socio A", customer_names)


class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_superuser(
            username="efrain.leyva",
            email="efrain@gummylovers.local",
            password="testpass123",
            first_name="Efrain",
            last_name="Leyva",
        )

    def test_login_allows_seeded_admin(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "efrain@gummylovers.local", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "efrain.leyva")

    def test_me_allows_token_authentication(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "efrain@gummylovers.local", "password": "testpass123"},
            format="json",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {login_response.data['token']}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "efrain.leyva")

    def test_dashboard_requires_authentication(self):
        response = self.client.get("/api/dashboard/financial/")

        self.assertEqual(response.status_code, 401)

    def test_admin_profiles_are_protected(self):
        response = self.client.get("/api/auth/admins/")

        self.assertEqual(response.status_code, 401)
