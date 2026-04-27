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
    Supplier,
)


class CoreServiceTests(TestCase):
    def setUp(self):
        self.partner_a = Partner.objects.create(code="A", name="Ana")
        self.partner_b = Partner.objects.create(code="B", name="Beto")
        self.customer = CustomerNode.objects.create(name="Cliente Centro")
        self.product = Product.objects.create(
            partner=self.partner_a,
            sku="GOM-001",
            name="Gomita enchilada",
            grams_per_piece=Decimal("2.5000"),
            recovery_price=Decimal("15.00"),
        )
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
        self.assertEqual(line.recovery_unit_price_snapshot, Decimal("15.00"))
        self.assertEqual(line.recovery_amount, Decimal("150.00"))

    def test_payment_smart_split_prioritizes_expense_then_inventory_then_profit(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 10}],
            sold_by_partner=self.partner_a,
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
            Decimal("150.00"),
        )
        self.assertEqual(
            services.sum_amount(allocations.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT)),
            Decimal("100.00"),
        )
        self.assertEqual(
            services.sum_amount(
                allocations.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT, partner=self.partner_a)
            ),
            Decimal("100.00"),
        )
        self.assertEqual(
            services.sum_amount(
                allocations.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT, partner=self.partner_b)
            ),
            Decimal("0.00"),
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
            Decimal("60.00"),
        )
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT, partner=self.partner_a)
            ),
            Decimal("40.00"),
        )

    def test_supplier_sale_uses_supplier_partner_for_profit(self):
        supplier = Supplier.objects.create(name="Proveedor Norte", partner=self.partner_b)

        sale, payment = services.create_supplier_sale(
            partner=self.partner_a,
            supplier=supplier,
            product=self.product,
            portion=self.small,
            quantity=2,
            unit_price=Decimal("25.00"),
            paid_amount=Decimal("50.00"),
            method="cash",
        )

        self.assertEqual(sale.sold_by_partner, self.partner_b)
        self.assertEqual(payment.amount, Decimal("50.00"))
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)
            ),
            Decimal("30.00"),
        )
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT, partner=self.partner_b)
            ),
            Decimal("20.00"),
        )

    def test_direct_sale_below_recovery_price_records_loss(self):
        sale, payment = services.create_direct_sale(
            partner=self.partner_a,
            product=self.product,
            portion=self.small,
            portions_qty=1,
            unit_price=Decimal("10.00"),
            method="cash",
        )

        line = sale.lines.get()

        self.assertEqual(line.recovery_unit_price_snapshot, Decimal("15.00"))
        self.assertEqual(line.recovery_amount, Decimal("15.00"))
        self.assertEqual(payment.amount, Decimal("10.00"))
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)
            ),
            Decimal("10.00"),
        )
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT)
            ),
            Decimal("0.00"),
        )

    def test_recovery_amount_falls_back_for_legacy_sale_lines(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 2, "unit_price": Decimal("20.00")}],
            sold_by_partner=self.partner_a,
        )
        line = sale.lines.get()
        line.recovery_unit_price_snapshot = Decimal("0.00")
        line.recovery_amount = Decimal("0.00")
        line.save(update_fields=["recovery_unit_price_snapshot", "recovery_amount"])

        payment = services.record_customer_payment(
            customer=self.customer,
            amount=Decimal("40.00"),
            received_at=timezone.now(),
            method="cash",
            sale_allocations=[{"sale": sale, "amount": Decimal("40.00")}],
        )

        self.assertEqual(payment.amount, Decimal("40.00"))
        self.assertEqual(services.recovery_amount_for_sale_line(line), Decimal("30.00"))
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.INVENTORY_RESERVE)
            ),
            Decimal("30.00"),
        )
        self.assertEqual(
            services.sum_amount(
                SmartSplitAllocation.objects.filter(type=SmartSplitAllocation.Type.PARTNER_PROFIT, partner=self.partner_a)
            ),
            Decimal("10.00"),
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
        self.partner_a = Partner.objects.create(code="A", name="Ana", user=self.user)
        self.partner_b = Partner.objects.create(code="B", name="Beto")
        self.customer = CustomerNode.objects.create(name="Cliente Centro")
        self.product = Product.objects.create(
            partner=self.partner_a,
            sku="GOM-001",
            name="Gomita enchilada",
            grams_per_piece=Decimal("2.5000"),
            recovery_price=Decimal("15.00"),
        )
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

    def test_supplier_endpoint_saves_partner_assignment(self):
        response = self.client.post(
            "/api/suppliers/",
            {
                "name": "Proveedor Norte",
                "partner": str(self.partner_a.id),
                "phone": "6620000000",
                "notes": "",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data["partner"]), str(self.partner_a.id))
        self.assertEqual(response.data["partner_name"], self.partner_a.name)

        supplier_id = response.data["id"]
        patch_response = self.client.patch(
            f"/api/suppliers/{supplier_id}/",
            {"partner": str(self.partner_b.id)},
            format="json",
        )

        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(str(patch_response.data["partner"]), str(self.partner_a.id))
        self.assertEqual(patch_response.data["partner_name"], self.partner_a.name)

    def test_sales_endpoint_uses_authenticated_partner_as_seller(self):
        self.partner_a.name = "Efrain Leyva"
        self.partner_a.save()

        response = self.client.post(
            "/api/sales/",
            {
                "customer": str(self.customer.id),
                "items": [
                    {
                        "product": str(self.product.id),
                        "portion": str(self.small.id),
                        "portions_qty": 2,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["channel"], Sale.Channel.WHOLESALE)
        self.assertEqual(str(response.data["sold_by_partner"]), str(self.partner_a.id))
        self.assertEqual(response.data["sold_by_partner_name"], "Efrain Leyva")

    def test_sales_delete_removes_sale_payments_and_restores_inventory(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 1}],
            sold_by_partner=self.partner_a,
        )
        payment = services.record_customer_payment(
            customer=self.customer,
            amount=sale.total_amount,
            received_at=timezone.now(),
            method="cash",
            sale_allocations=[{"sale": sale, "amount": sale.total_amount}],
        )
        lot = InventoryLot.objects.get(lot_code="L-001")
        self.assertEqual(lot.remaining_grams, Decimal("985.000"))

        response = self.client.delete(f"/api/sales/{sale.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Sale.objects.filter(id=sale.id).exists())
        self.assertFalse(CustomerPayment.objects.filter(id=payment.id).exists())
        self.assertFalse(SmartSplitAllocation.objects.exists())
        lot.refresh_from_db()
        self.assertEqual(lot.remaining_grams, Decimal("1000.000"))

        list_response = self.client.get("/api/sales/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])

    def test_regular_lists_are_scoped_to_authenticated_partner_and_global_scope_is_available(self):
        supplier_a = Supplier.objects.create(name="Proveedor A", partner=self.partner_a)
        supplier_b = Supplier.objects.create(name="Proveedor B", partner=self.partner_b)
        product_b = Product.objects.create(
            partner=self.partner_b,
            sku="GOM-B",
            name="Gomita privada B",
            grams_per_piece=Decimal("1.0000"),
            recovery_price=Decimal("12.00"),
        )
        portion_b = PortionSize.objects.create(product=product_b, name=services.DEFAULT_PORTION_NAME, pieces_per_portion=1)
        InventoryLot.objects.create(
            product=product_b,
            lot_code="L-B",
            boxes_qty=1,
            bags_per_box=1,
            kg_per_bag=Decimal("1.000"),
            box_cost=Decimal("100.00"),
            total_grams=Decimal("1000.000"),
            remaining_grams=Decimal("1000.000"),
            total_cost=Decimal("100.00"),
            paid_by_partner=self.partner_b,
            purchased_at=timezone.localdate(),
        )
        sale_a = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 1}],
            sold_by_partner=self.partner_a,
        )
        sale_b = services.create_sale(
            customer=self.customer,
            lines=[{"product": product_b, "portion": portion_b, "portions_qty": 1, "unit_price": Decimal("20.00")}],
            sold_by_partner=self.partner_b,
        )

        products_response = self.client.get("/api/products/?active=true")
        suppliers_response = self.client.get("/api/suppliers/?active=true")
        sales_response = self.client.get("/api/sales/")
        global_suppliers_response = self.client.get("/api/suppliers/?active=true&scope=all")
        global_sales_response = self.client.get("/api/sales/?scope=all")
        hidden_delete_response = self.client.delete(f"/api/products/{product_b.id}/")

        self.assertEqual(products_response.status_code, 200)
        self.assertEqual(suppliers_response.status_code, 200)
        self.assertEqual(sales_response.status_code, 200)
        self.assertEqual(global_suppliers_response.status_code, 200)
        self.assertEqual(global_sales_response.status_code, 200)
        self.assertEqual(hidden_delete_response.status_code, 404)

        self.assertEqual({item["sku"] for item in products_response.data}, {self.product.sku})
        self.assertEqual({item["name"] for item in suppliers_response.data}, {supplier_a.name})
        self.assertEqual({item["id"] for item in sales_response.data}, {str(sale_a.id)})
        self.assertEqual({item["name"] for item in global_suppliers_response.data}, {supplier_a.name, supplier_b.name})
        self.assertEqual({item["id"] for item in global_sales_response.data}, {str(sale_a.id), str(sale_b.id)})
        self.assertTrue(Product.objects.filter(id=product_b.id).exists())

    def test_sales_cancel_action_hard_deletes_sale(self):
        sale = services.create_sale(
            customer=self.customer,
            lines=[{"product": self.product, "portion": self.small, "portions_qty": 1}],
            sold_by_partner=self.partner_a,
        )

        response = self.client.post(f"/api/sales/{sale.id}/cancel/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Sale.objects.filter(id=sale.id).exists())

    def test_supplier_and_product_delete_actions_remove_records_and_free_names(self):
        supplier = Supplier.objects.create(name="Proveedor Sur", partner=self.partner_a)
        product = Product.objects.create(
            partner=self.partner_a,
            sku="GOM-002",
            name="Gomita mango",
            grams_per_piece=Decimal("1.0000"),
            recovery_price=Decimal("15.00"),
        )
        PortionSize.objects.create(product=product, name=services.DEFAULT_PORTION_NAME, pieces_per_portion=1)

        supplier_response = self.client.delete(f"/api/suppliers/{supplier.id}/")
        product_response = self.client.delete(f"/api/products/{product.id}/")

        self.assertEqual(supplier_response.status_code, 204)
        self.assertEqual(product_response.status_code, 204)
        self.assertFalse(Supplier.objects.filter(id=supplier.id).exists())
        self.assertFalse(Product.objects.filter(id=product.id).exists())

        supplier_recreated = Supplier.objects.create(name="Proveedor Sur", partner=self.partner_a)
        product_recreated = Product.objects.create(
            partner=self.partner_a,
            sku="GOM-002",
            name="Gomita mango nueva",
            grams_per_piece=Decimal("1.0000"),
            recovery_price=Decimal("15.00"),
        )

        self.assertEqual(supplier_recreated.name, "Proveedor Sur")
        self.assertEqual(product_recreated.sku, "GOM-002")

    def test_inactive_supplier_and_product_do_not_block_reuse(self):
        Supplier.objects.create(name="Proveedor Fantasma", partner=self.partner_a, active=False)
        Product.objects.create(
            partner=self.partner_a,
            sku="GOM-999",
            name="Gomita eliminada",
            grams_per_piece=Decimal("1.0000"),
            recovery_price=Decimal("15.00"),
            active=False,
        )

        supplier_response = self.client.post(
            "/api/suppliers/",
            {"name": "Proveedor Fantasma", "phone": "", "notes": "", "active": True},
            format="json",
        )
        product_response = self.client.post(
            "/api/products/",
            {
                "sku": "GOM-999",
                "name": "Gomita nueva",
                "wholesale_price": "0.00",
                "grams_per_piece": "1.0000",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(supplier_response.status_code, 201)
        self.assertEqual(product_response.status_code, 201)

    def test_product_endpoint_allows_editing_recovery_price(self):
        create_response = self.client.post(
            "/api/products/",
            {
                "sku": "GOM-REC",
                "name": "Gomita con precio editable",
                "wholesale_price": "0.00",
                "grams_per_piece": "1.0000",
                "recovery_price": "18.00",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["recovery_price"], "18.00")

        product = Product.objects.get(id=create_response.data["id"])
        portion = PortionSize.objects.get(product=product, name=services.DEFAULT_PORTION_NAME)
        self.assertEqual(product.recovery_price, Decimal("18.00"))
        self.assertEqual(portion.recovery_price, Decimal("0.00"))

        update_response = self.client.patch(
            f"/api/products/{product.id}/",
            {"recovery_price": "22.50"},
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data["recovery_price"], "22.50")
        product.refresh_from_db()
        self.assertEqual(product.recovery_price, Decimal("22.50"))

    def test_expense_endpoint_uses_authenticated_partner(self):
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

    def test_inventory_lot_endpoint_uses_authenticated_partner_by_default(self):
        self.partner_a.name = "Efrain Leyva"
        self.partner_a.save()

        response = self.client.post(
            "/api/inventory-lots/",
            {
                "product": str(self.product.id),
                "lot_code": "L-002",
                "boxes_qty": 2,
                "bags_per_box": 4,
                "kg_per_bag": "1.000",
                "box_cost": "650.00",
                "purchased_at": str(timezone.localdate()),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(str(response.data["paid_by_partner"]), str(self.partner_a.id))
        self.assertEqual(response.data["total_grams"], "8000.000")
        self.assertEqual(response.data["remaining_grams"], "8000.000")
        self.assertEqual(response.data["total_cost"], "1300.00")

    def test_direct_sale_endpoint_creates_paid_sale_for_authenticated_partner(self):
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
