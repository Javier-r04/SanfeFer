-- Tarjeta deja de usarse: el segundo método de pago es transferencia.
ALTER TYPE "PaymentMethod" RENAME VALUE 'CARD' TO 'TRANSFER';
