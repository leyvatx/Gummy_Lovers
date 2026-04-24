# Generated manually for supplier-linked wholesale sales.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_product_wholesale_price_supplier_active_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customernode",
            name="kind",
            field=models.CharField(
                choices=[("wholesale", "Proveedor"), ("direct", "Venta directa")],
                db_index=True,
                default="wholesale",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="sale",
            name="channel",
            field=models.CharField(
                choices=[("wholesale", "Venta a proveedores"), ("direct", "Venta propia")],
                db_index=True,
                default="wholesale",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sales_received",
                to="core.supplier",
            ),
        ),
        migrations.AddIndex(
            model_name="sale",
            index=models.Index(fields=["supplier", "status"], name="core_sale_supplie_2b2a34_idx"),
        ),
    ]
