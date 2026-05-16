window.LANG = {
  // Meta
  pageTitle: 'Generador de Lista de Cortes MDF',
  appName: 'CutList',

  // Encabezado
  projectNamePlaceholder: 'Nombre del proyecto…',
  exportPdf: 'Exportar PDF',

  // Sección lámina
  sectionSheet: 'Lámina',
  presetCustom: 'Personalizado',
  labelWidth: 'Ancho',
  labelHeight: 'Alto',

  // Lista de cortes (panel izquierdo)
  sectionCutList: 'Lista de Cortes',
  btnAddPiece: '+ Agregar Pieza',

  // Herrajes
  sectionHardware: 'Herrajes',
  btnAddItem: '+ Agregar Ítem',

  // Barra de resumen
  sumSheetsLabel: 'Láminas',
  sumWasteLabel: 'Desperdicio',
  sumPiecesLabel: 'Piezas',

  // Panel lista de cortes (panel derecho)
  cutListPanelTitle: 'Lista de Cortes',
  toggleHide: 'Ocultar',
  toggleShow: 'Mostrar',

  // Encabezados de tabla
  thNum: '#',
  thName: 'Nombre',
  thQty: 'Cant.',
  thWidth: 'Ancho',
  thLength: 'Largo',
  thEdgeBanding: 'Canto',

  // Estado vacío
  emptyStateText: 'Agrega piezas para ver el diseño de láminas.',

  // Fila de pieza (renderizado dinámico)
  pieceNameLabel: 'Nombre',
  pieceQtyLabel: 'Cant.',
  pieceWidthLabel: 'Ancho',
  pieceLengthLabel: 'Largo',
  pieceBandLabel: 'Canto:',
  edgeTopLabel: 'A',
  edgeBottomLabel: 'B',
  edgeLeftLabel: 'I',
  edgeRightLabel: 'D',
  edgeTopTitle: 'Arriba',
  edgeBottomTitle: 'Abajo',
  edgeLeftTitle: 'Izquierda',
  edgeRightTitle: 'Derecha',
  btnDupTitle: 'Duplicar',
  btnDelTitle: 'Eliminar',
  pieceNamePlaceholder: 'p.ej. TAPA',
  defaultPieceName: 'Pieza',
  copySuffix: ' (copia)',
  ebNoneLabel: 'ninguno',

  // Fila de herraje (renderizado dinámico)
  hwDescPlaceholder: 'p.ej. Bisagra codo 35mm',
  btnRemoveTitle: 'Eliminar',

  // Tarjetas de lámina (renderizado dinámico)
  sheetCardTitle: (n, total) => `Lámina ${n} de ${total}`,
  wasteLabel: 'Desperdicio:',

  // Banner de advertencia (renderizado dinámico)
  warningUnplaced: (count, names) =>
    `⚠ ${count} instancia(s) no pudo(ieron) ubicarse (demasiado grande para la lámina): ${names}`,

  // Cadenas para PDF
  pdfUntitled: 'Proyecto sin título',
  pdfGenerated: 'Generado:',
  pdfSheetSize: 'Lámina:',
  pdfSheetsNeeded: 'Láminas necesarias:',
  pdfCutList: 'Lista de Cortes',
  pdfColName: 'Nombre',
  pdfColQty: 'Cant.',
  pdfColW: 'An',
  pdfColL: 'Lg',
  pdfColEdgeBanding: 'Canto',
  pdfHardware: 'Herrajes',
  pdfColDescription: 'Descripción',
  pdfEbTop: 'Arr',
  pdfEbBot: 'Aba',
  pdfEbLeft: 'Izq',
  pdfEbRight: 'Der',
  pdfSheetTitle: (n, total) => `Lámina ${n} de ${total}`,
  pdfWaste: 'Desperdicio:',
  jspdfError: 'jsPDF no cargado. Verifica tu conexión a internet.',
  donate: 'Invítame un chocolate',
};
