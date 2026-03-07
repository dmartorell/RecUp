export const MOCK_CARDS = [
  {
    is_bug: true,
    rawTranscript: 'cuando enciendo una luz se me apaga el microondas cuando enciendo el microondas se me abre la puerta del garaje en qué está pasando.',
    transcript: 'cuando enciendo una luz se me apaga el microondas cuando enciendo el microondas se me abre la puerta del garaje en qué está pasando.',
    title: 'Interferencia eléctrica entre dispositivos del hogar',
    bullets: [
      'Al encender la luz se apaga el microondas',
      'Al encender el microondas se abre automáticamente la puerta del garaje',
      'Posible interferencia eléctrica o problema de circuitos compartidos',
      'Los dispositivos se afectan mutuamente de forma anómala',
    ],
    duration: 8000,
    createdAt: new Date(Date.now() - 3 * 60000),
  },
  {
    is_bug: true,
    rawTranscript: 'no puedo entrar en mi casa los accesos están todos bloqueados y el login no funciona.',
    transcript: 'no puedo entrar en mi casa los accesos están todos bloqueados y el login no funciona.',
    title: 'Accesos bloqueados y login no funciona',
    bullets: [
      'Usuario no puede iniciar sesión',
      'Todos los accesos están bloqueados',
      'Función de login no operativa',
    ],
    duration: 6000,
    createdAt: new Date(Date.now() - 1 * 60000),
  },
  {
    is_bug: false,
    rawTranscript: 'hola buenos días a todos cómo estamos esto es una prueba un dos tres.',
    transcript: 'hola buenos días a todos cómo estamos esto es una prueba un dos tres.',
    title: null,
    bullets: [],
    duration: 1000,
    createdAt: new Date(Date.now() - 30000),
  },
];
