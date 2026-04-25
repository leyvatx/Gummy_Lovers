from decimal import Decimal

from django.db import migrations


def normalize_name(value):
    return (value or "").strip().lower().replace(" ", "").replace("-", "")


def fixed_recovery_price(name):
    normalized = normalize_name(name)
    if normalized in {"g1", "chico", "chica", "unidad"}:
        return Decimal("15.00")
    if normalized in {"g2", "grande"}:
        return Decimal("30.00")
    return Decimal("0.00")


def backfill_sale_line_recovery(apps, schema_editor):
    PortionSize = apps.get_model("core", "PortionSize")
    SaleLine = apps.get_model("core", "SaleLine")

    for portion in PortionSize.objects.all():
        price = fixed_recovery_price(portion.name)
        if price > 0 and portion.recovery_price != price:
            portion.recovery_price = price
            portion.save(update_fields=["recovery_price", "updated_at"])

    for line in SaleLine.objects.select_related("portion").all():
        price = line.recovery_unit_price_snapshot
        if price <= 0:
            price = line.portion.recovery_price or fixed_recovery_price(line.portion.name)
        if price <= 0:
            continue

        recovery_amount = Decimal(line.portions_qty) * price
        if line.recovery_unit_price_snapshot != price or line.recovery_amount != recovery_amount:
            line.recovery_unit_price_snapshot = price
            line.recovery_amount = recovery_amount
            line.save(update_fields=["recovery_unit_price_snapshot", "recovery_amount", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_fixed_recovery_prices"),
    ]

    operations = [
        migrations.RunPython(backfill_sale_line_recovery, migrations.RunPython.noop),
    ]
