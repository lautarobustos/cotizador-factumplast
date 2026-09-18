const express = require('express');
const tarifas = require('./precios.json');

const app = express();
app.use(express.json());

// Endpoint de cotización que consulta Tiendanube
app.post('/cotizar-envio', (req, res) => {
  try {
    console.log('--- NUEVA CONSULTA ENTRANTE ---');
    const { destination, items } = req.body || {};

    const rawCp = destination?.postal_code || '';
    const cp = String(rawCp).replace(/\D/g, '');

    const tarifaDestino = tarifas[cp];

    if (!tarifaDestino) {
      console.log(`CP ${cp} no encontrado en precios.json`);
      return res.status(200).json({ rates: [] });
    }

    let costoTotalEnvio = 0;
    const itemsList = Array.isArray(items) && items.length > 0 ? items : [];

    for (const item of itemsList) {
      let peso = 0;
      if (item.grams !== undefined && item.grams !== null) {
        peso = parseFloat(item.grams) / 1000;
      } else if (item.weight !== undefined && item.weight !== null) {
        peso = parseFloat(String(item.weight).replace(',', '.')) || 0;
      }

      const cantidad = parseInt(item.quantity, 10) || 1;
      let precioUnitario = 0;

      if (peso >= 300 && peso <= 450) {
        precioUnitario = tarifaDestino.tramo_300_400;
      } else if (peso > 450 && peso <= 650) {
        precioUnitario = tarifaDestino.tramo_500_550;
      } else if (peso > 650) {
        precioUnitario = tarifaDestino.tramo_750_1200;
      } else {
        precioUnitario = tarifaDestino.tramo_300_400;
      }

      costoTotalEnvio += Number(precioUnitario || 0) * cantidad;
    }

    // Calculamos entrega estimada (de 3 a 7 días a partir de hoy)
    const hoy = new Date();
    const minDate = new Date(hoy);
    minDate.setDate(hoy.getDate() + 3);
    const maxDate = new Date(hoy);
    maxDate.setDate(hoy.getDate() + 7);

    const responsePayload = {
      rates: [
        {
          name: `Flete Directo (${tarifaDestino.destino})`,
          code: 'FLETE_FACTUMPLAST',
          type: 'ship',
          price: Number(costoTotalEnvio),
          cost: Number(costoTotalEnvio),
          currency: 'ARS',
          min_delivery_date: minDate.toISOString(),
          max_delivery_date: maxDate.toISOString(),
          phone_required: true
        }
      ]
    };

    console.log('Respuesta despachada:', JSON.stringify(responsePayload));
    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Error al cotizar envío:', error);
    return res.status(500).json({ error: 'Error interno del cotizador' });
  }
});

// Webhooks de privacidad requeridos por Tiendanube
app.post('/webhook/store-redact', (req, res) => res.sendStatus(200));
app.post('/webhook/customers-redact', (req, res) => res.sendStatus(200));
app.post('/webhook/customers-data', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
