export const MOCK_CARDS = [
  {
    is_bug: true,
    rawTranscript: 'en la sección de consumos energéticos las gráficas de electricidad del último mes no cargan se quedan en blanco y si cambias a la vista semanal tampoco aparecen los datos solo se ve el eje vertical sin ninguna barra.',
    transcript: 'en la sección de consumos energéticos las gráficas de electricidad del último mes no cargan se quedan en blanco y si cambias a la vista semanal tampoco aparecen los datos solo se ve el eje vertical sin ninguna barra.',
    title: 'Gráficas de consumo eléctrico no cargan datos',
    bullets: [
      'Las gráficas de electricidad del último mes se quedan en blanco',
      'En vista semanal tampoco se renderizan los datos',
      'Solo se muestra el eje vertical sin barras ni valores',
    ],
    duration: 14000,
    createdAt: new Date(Date.now() - 47 * 60000),
  },
  {
    is_bug: true,
    rawTranscript: 'un inquilino nos ha reportado que al intentar abrir la puerta del parking desde la app le sale un error de timeout y tiene que reintentar tres o cuatro veces hasta que finalmente se abre pero tarda bastante más de lo normal.',
    transcript: 'un inquilino nos ha reportado que al intentar abrir la puerta del parking desde la app le sale un error de timeout y tiene que reintentar tres o cuatro veces hasta que finalmente se abre pero tarda bastante más de lo normal.',
    title: 'Timeout intermitente al abrir puerta de parking desde la app',
    bullets: [
      'El usuario recibe error de timeout al accionar la puerta del parking',
      'Requiere entre 3 y 4 reintentos para conseguir abrir',
      'La apertura tarda significativamente más de lo habitual',
    ],
    duration: 11000,
    createdAt: new Date(Date.now() - 6 * 60000),
  },
  {
    is_bug: true,
    rawTranscript: 'en la app de inquilinos cuando le das a programar el encendido de la calefacción se guarda la hora pero luego no se ejecuta a la hora programada y el inquilino tiene que encenderla manualmente cada vez.',
    transcript: 'en la app de inquilinos cuando le das a programar el encendido de la calefacción se guarda la hora pero luego no se ejecuta a la hora programada y el inquilino tiene que encenderla manualmente cada vez.',
    title: 'Programación de calefacción no se ejecuta a la hora configurada',
    bullets: [
      'La hora programada se guarda correctamente en la app',
      'La calefacción no se enciende automáticamente a la hora establecida',
      'El inquilino tiene que activarla manualmente cada vez',
    ],
    duration: 18000,
    createdAt: new Date(Date.now() - 2 * 60000),
  },
];
