window.LANG = {
  // Meta
  pageTitle: 'MDF Cut List Generator',
  appName: 'CutList',

  // Header
  projectNamePlaceholder: 'Project name…',
  exportPdf: 'Export PDF',

  // Sheet section
  sectionSheet: 'Sheet',
  presetCustom: 'Custom',
  labelWidth: 'Width',
  labelHeight: 'Height',

  // Cut list section (left panel)
  sectionCutList: 'Cut List',
  btnAddPiece: '+ Add Piece',

  // Hardware section
  sectionHardware: 'Hardware',
  btnAddItem: '+ Add Item',

  // Summary bar
  sumSheetsLabel: 'Sheets',
  sumWasteLabel: 'Avg Waste',
  sumPiecesLabel: 'Pieces',

  // Cut list panel (right panel header)
  cutListPanelTitle: 'Cut List',
  toggleHide: 'Hide',
  toggleShow: 'Show',

  // Cut list table headers
  thNum: '#',
  thName: 'Name',
  thQty: 'Qty',
  thWidth: 'Width',
  thLength: 'Length',
  thEdgeBanding: 'Edge Banding',

  // Empty state
  emptyStateText: 'Add pieces to see the sheet layout.',

  // Piece row (rendered dynamically)
  pieceNameLabel: 'Name',
  pieceQtyLabel: 'Qty',
  pieceWidthLabel: 'Width',
  pieceLengthLabel: 'Length',
  pieceBandLabel: 'Band:',
  edgeTopLabel: 'T',
  edgeBottomLabel: 'B',
  edgeLeftLabel: 'L',
  edgeRightLabel: 'R',
  edgeTopTitle: 'Top',
  edgeBottomTitle: 'Bottom',
  edgeLeftTitle: 'Left',
  edgeRightTitle: 'Right',
  btnDupTitle: 'Duplicate',
  btnDelTitle: 'Delete',
  pieceNamePlaceholder: 'e.g. TAPA',
  defaultPieceName: 'Part',
  copySuffix: ' (copy)',
  ebNoneLabel: 'none',

  // Hardware row (rendered dynamically)
  hwDescPlaceholder: 'e.g. 35mm hinge',
  btnRemoveTitle: 'Remove',

  // Sheet cards (rendered dynamically)
  sheetCardTitle: (n, total) => `Sheet ${n} of ${total}`,
  wasteLabel: 'Waste:',

  // Warning banner (rendered dynamically)
  warningUnplaced: (count, names) =>
    `⚠ ${count} piece instance(s) could not be placed (too large for sheet): ${names}`,

  // PDF strings
  pdfUntitled: 'Untitled Project',
  pdfGenerated: 'Generated:',
  pdfSheetSize: 'Sheet:',
  pdfSheetsNeeded: 'Sheets needed:',
  pdfCutList: 'Cut List',
  pdfColName: 'Name',
  pdfColQty: 'Qty',
  pdfColW: 'W',
  pdfColL: 'L',
  pdfColEdgeBanding: 'Edge Banding',
  pdfHardware: 'Hardware',
  pdfColDescription: 'Description',
  pdfEbTop: 'Top',
  pdfEbBot: 'Bot',
  pdfEbLeft: 'Left',
  pdfEbRight: 'Right',
  pdfSheetTitle: (n, total) => `Sheet ${n} of ${total}`,
  pdfWaste: 'Waste:',
  jspdfError: 'jsPDF not loaded. Check your internet connection.',
};
