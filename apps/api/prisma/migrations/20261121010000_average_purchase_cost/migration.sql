-- El costo de compra pasa a ser el promedio ponderado de las entradas.
-- Se recalcula para cada artículo repasando su historial en orden; el stock no cambia.
DO $$
DECLARE
  item RECORD;
  mv RECORD;
  cost NUMERIC;
  before_qty NUMERIC;
BEGIN
  FOR item IN SELECT id FROM "InventoryItem" LOOP
    cost := 0;
    FOR mv IN
      SELECT type, quantity, "unitCost", "stockAfter"
      FROM "InventoryMovement"
      WHERE "inventoryItemId" = item.id
      ORDER BY "createdAt", id
    LOOP
      IF mv.type IN ('INITIAL', 'PURCHASE', 'MANUAL_IN') AND mv.quantity > 0 AND mv."unitCost" IS NOT NULL THEN
        before_qty := mv."stockAfter" - mv.quantity;
        IF before_qty <= 0 THEN
          cost := mv."unitCost";
        ELSE
          cost := (before_qty * cost + mv.quantity * mv."unitCost") / mv."stockAfter";
        END IF;
      ELSIF mv.type = 'PURCHASE_VOID' AND mv."unitCost" IS NOT NULL AND mv."stockAfter" > 0 THEN
        before_qty := mv."stockAfter" - mv.quantity; -- quantity es negativa
        cost := GREATEST(0, (before_qty * cost + mv.quantity * mv."unitCost") / mv."stockAfter");
      END IF;
      cost := ROUND(cost, 4);
    END LOOP;
    -- Solo artículos con historial: los demás conservan su costo.
    IF EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "inventoryItemId" = item.id) THEN
      UPDATE "InventoryItem" SET "averageCost" = cost WHERE id = item.id;
    END IF;
  END LOOP;
END $$;
