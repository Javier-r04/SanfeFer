-- Solo puede haber una caja abierta a la vez (índice único parcial; Prisma no lo puede declarar en el esquema).
CREATE UNIQUE INDEX "CashSession_single_open" ON "CashSession" ("status") WHERE "status" = 'OPEN';
