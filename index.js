const express = require('express');
const tarifas = require('./precios.json');

const app = express();
app.use(express.json());

// Endpoint de cotización que consultará Tiendanube
app.post('/cotizar-envio', (req, res) => {
  try {
    const { destination, items } = req.body;

    // Extraemos solo los números del Código Postal (ej: "B1714" -> "1714")
    const rawCp = destination?.postal_code || '';
    const cp = rawCp.replace(/\D/g, '');

    const tarifaDestino = tarifas[cp];

    // Si el CP no existe en tu tabla, no ofrecemos envío para esa zona
    if (!tarifaDestino) {
      return res.status(200).json({ rates: [] });
    }

    let costoTotalEnvio = 0;

    // Recorremos cada producto del carrito
    for (const item of items) {
      const peso = parseFloat(item.weight) || 0;
      const cantidad = parseInt(item.quantity, 10) || 1;

      let precioUnitario = 0;

      // Determinamos tarifa según los kilos/litros cargados en el producto
      if (peso >= 300 && peso <= 450) {
        precioUnitario = tarifaDestino.tramo_300_400;
      } else if (peso > 450 && peso <= 650) {
        precioUnitario = tarifaDestino.tramo_500_550;
      } else if (peso > 650) {
        precioUnitario = tarifaDestino.tramo_750_1200;
      } else {
        // En caso de que no tenga peso o sea accesorio chico
        precioUnitario = tarifaDestino.tramo_300_400;
      }

      // Multiplicamos por la cantidad elegida
      costoTotalEnvio += precioUnitario * cantidad;
    }

    // Estructura oficial que Tiendanube espera recibir
    return res.status(200).json({
      rates: [
        {
          name: `Flete Directo (${tarifaDestino.destino})`,
          code: 'FLETE_FACTUMPLAST',
          price: costoTotalEnvio,
          currency: 'ARS',
          type: 'ship',
          min_delivery_date: null,
          max_delivery_date: null,
          phone_required: true
        }
      ]
    });
  } catch (error) {
    console.error('Error al cotizar envío:', error);
    return res.status(500).json({ error: 'Error interno del cotizador' });
  }
});

// Webhooks de privacidad requeridos por Tiendanube
app.post('/webhook/store-redact', (req, res) => res.sendStatus(200));
app.post('/webhook/customers-redact', (req, res) => res.sendStatus(200));
app.post('/webhook/customers-data', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});