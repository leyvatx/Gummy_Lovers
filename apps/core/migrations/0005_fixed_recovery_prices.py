# Generated manually for fixed G1/G2 recovery prices.

from decimal import Decimal

import django.core.validators
from django.db import migrations, models


def normalize_name(value):
    return (value or "").strip().lower().replace(" ", "").replace("-", "")


def recovery_price_for_name(name):
    normalized = normalize_name(name)
    if normalized in {"g1", "chico", "chica", "unidad"}:
        return Decimal("15.00")
    if normalized in {"g2", "grande"}:
        return Decimal("30.00")
    return Decimal("0.00")


def seed_fixed_sizes(apps, schema_editor):
    Product = apps.get_model("core", "Product")
    PortionSize = apps.get_model("core", "PortionSize")
    SaleLine = apps.get_model("core", "SaleLine")

    for product in Product.objects.all():
        for name, price in (("G1", Decimal("15.00")), ("G2", Decimal("30.00"))):
            portion, _ = PortionSize.objects.get_or_create(
                product=product,
                name=name,
                defaults={
                    "pieces_per_portion": 1,
                    "recovery_price": price,
                    "active": True,
                },
            )
            changed_fields = []
            if portion.recovery_price != price:
                portion.recovery_price = price
                changed_fields.append("recovery_price")
            if not portion.active:
                portion.active = True
                changed_fields.append("active")
            if changed_fields:
                portion.save(update_fields=[*changed_fields, "updated_at"])

        for portion in PortionSize.objects.filter(product=product):
            price = recovery_price_for_name(portion.name)
            if price > 0 and portion.recovery_price != price:
                portion.recovery_price = price
                portion.save(update_fields=["recovery_price", "updated_at"])

    for line in SaleLine.objects.select_related("portion").all():
        price = line.portion.recovery_price or recovery_price_for_name(line.portion.name)
        if price <= 0:
            continue
        line.recovery_unit_price_snapshot = price
        line.recovery_amount = Decimal(line.portions_qty) * price
        line.save(update_fields=["recovery_unit_price_snapshot", "recovery_amount", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_sale_supplier"),
    ]

    operations = [
        migrations.AddField(
            model_name="portionsize",
            name="recovery_price",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=12,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="saleline",
            name="recovery_unit_price_snapshot",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=12,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="saleline",
            name="recovery_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=14,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.RunPython(seed_fixed_sizes, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="saleline",
            constraint=models.CheckConstraint(
                condition=models.Q(("recovery_unit_price_snapshot__gte", 0)),
                name="sale_line_recovery_unit_gte_0",
            ),
        ),
        migrations.AddConstraint(
            model_name="saleline",
            constraint=models.CheckConstraint(
                condition=models.Q(("recovery_amount__gte", 0)),
                name="sale_line_recovery_amount_gte_0",
            ),
        ),
    ]
