// store-sync.js
// -----------------------------------------------------------------------------
// Sincroniza el localStorage de asesorías con el SERVIDOR (base de datos), para
// que dejen de estar atrapadas en un solo navegador:
//   - Al cargar la página: trae del servidor todas las llaves "teacherAdvisories_*"
//     y las mete en localStorage (de forma SÍNCRONA, para que el código existente
//     de teacher.html / student.html las lea sin cambios).
//   - En cada escritura: intercepta localStorage.setItem y refleja el cambio al
//     servidor (PUT /api/kv/<llave>).
//
// Así las asesorías se comparten entre todas las computadoras y el panel del
// Director puede leerlas. El almacén (kv_store) arranca vacío y se llena con las
// asesorías reales que publican los maestros.
// -----------------------------------------------------------------------------
(function () {
  // 1) Hidratar localStorage desde el servidor (síncrono a propósito)
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/kv', false); // false = síncrono
    xhr.send();
    if (xhr.status === 200) {
      var data = JSON.parse(xhr.responseText || '{}');
      Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); });
    }
  } catch (e) {
    console.warn('[store-sync] No se pudo hidratar desde el servidor:', e);
  }

  // 2) Interceptar escrituras de asesorías para reflejarlas al servidor
  var _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _setItem(key, value); // comportamiento normal
    if (typeof key === 'string' && key.indexOf('teacherAdvisories_') === 0) {
      try {
        var x = new XMLHttpRequest();
        x.open('PUT', '/api/kv/' + encodeURIComponent(key), true); // async (no bloquea la UI)
        x.setRequestHeader('Content-Type', 'application/json');
        x.send(JSON.stringify({ value: value }));
      } catch (e) {
        console.warn('[store-sync] No se pudo guardar en el servidor:', e);
      }
    }
  };
})();
