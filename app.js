const STORAGE_KEY = "coherence-diagramming-docs";

const els = {
  workspace: document.getElementById("workspace"),
  diagram: document.getElementById("diagram"),
  viewport: document.getElementById("viewport"),
  shapesLayer: document.getElementById("shapesLayer"),
  connectionsLayer: document.getElementById("connectionsLayer"),
  docTitle: document.getElementById("docTitle"),
  docList: document.getElementById("docList"),
  zoomLabel: document.getElementById("zoomLabel"),
  fillColor: document.getElementById("fillColor"),
  strokeColor: document.getElementById("strokeColor"),
  textColor: document.getElementById("textColor"),
  strokeWidth: document.getElementById("strokeWidth"),
  strokeWidthValue: document.getElementById("strokeWidthValue"),
  fontSize: document.getElementById("fontSize"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  colorGrid: document.getElementById("colorGrid"),
  activeColorPreview: document.getElementById("activeColorPreview"),
  activeColorLabel: document.getElementById("activeColorLabel"),
  transparentColorBtn: document.getElementById("transparentColorBtn"),
  arrowStart: document.getElementById("arrowStart"),
  arrowEnd: document.getElementById("arrowEnd"),
  selectionInfo: document.getElementById("selectionInfo"),
  shapeTextField: document.getElementById("shapeTextField"),
  shapeTextInput: document.getElementById("shapeTextInput"),
  deleteBtn: document.getElementById("deleteBtn"),
  importInput: document.getElementById("importInput"),
};

const defaultStyle = {
  fill: "#ffffff",
  stroke: "#2563eb",
  text: "#111827",
  strokeWidth: 2,
  fontSize: 16,
  arrowStart: false,
  arrowEnd: true,
};

let docs = loadDocs();
let activeDocId = docs[0]?.id || null;
if (!activeDocId) {
  activeDocId = createDocument("Untitled diagram").id;
}
let tool = "select";
let selected = null;
let selectedShapeIds = [];
let action = null;
let spaceDown = false;
let draftConnection = null;
let editingShapeId = null;
let lastShapeClick = { id: null, time: 0 };
let activeColorTarget = "fill";

const paletteColors = [
  "#ffffff", "#f8fafc", "#e5e7eb", "#9ca3af", "#6b7280", "#4b5563", "#111827", "#000000",
  "#fee2e2", "#fecaca", "#f87171", "#ef4444", "#dc2626", "#991b1b", "#7f1d1d", "#450a0a",
  "#ffedd5", "#fed7aa", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#431407",
  "#fef3c7", "#fde68a", "#facc15", "#eab308", "#ca8a04", "#a16207", "#854d0e", "#422006",
  "#dcfce7", "#bbf7d0", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#052e16",
  "#d1fae5", "#a7f3d0", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#022c22",
  "#cffafe", "#a5f3fc", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#083344",
  "#dbeafe", "#bfdbfe", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#172554",
  "#ede9fe", "#ddd6fe", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#2e1065",
  "#fce7f3", "#fbcfe8", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843",
];

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDocument(title) {
  const doc = {
    id: uid("doc"),
    title,
    updatedAt: Date.now(),
    view: { x: 360, y: 220, scale: 1 },
    shapes: [],
    connections: [],
  };
  docs.unshift(doc);
  saveDocs();
  return doc;
}

function loadDocs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return [];
}

function saveDocs() {
  const doc = getDoc();
  if (doc) doc.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function getDoc() {
  return docs.find((doc) => doc.id === activeDocId);
}

function setTool(nextTool) {
  tool = nextTool;
  document.querySelectorAll(".tool").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  els.workspace.dataset.tool = tool;
  cancelDraftConnection();
  render();
}

function currentColorValue() {
  const target = selected?.type === "shape" ? findShape(selected.id) : selected?.type === "connection" ? findConnection(selected.id) : null;
  const style = target?.style || defaultStyle;
  if (activeColorTarget === "fill") return style.fill ?? defaultStyle.fill;
  if (activeColorTarget === "stroke") return style.stroke ?? defaultStyle.stroke;
  return style.text ?? defaultStyle.text;
}

function setActiveColorTarget(target) {
  activeColorTarget = target;
  document.querySelectorAll(".color-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.colorTarget === activeColorTarget);
  });
  [els.fillColor, els.strokeColor, els.textColor].forEach((input) => {
    input.classList.remove("active-system-color");
  });
  colorInputForTarget(activeColorTarget).classList.add("active-system-color");
  renderPaletteState();
}

function colorInputForTarget(target) {
  if (target === "fill") return els.fillColor;
  if (target === "stroke") return els.strokeColor;
  return els.textColor;
}

function patchForColorTarget(target, color) {
  if (target === "fill") return { fill: color };
  if (target === "stroke") return { stroke: color };
  return { text: color };
}

function applyColor(target, color) {
  if (color !== "transparent") colorInputForTarget(target).value = color;
  updateSelectedStyle(patchForColorTarget(target, color));
  renderPaletteState();
}

function renderPalette() {
  els.colorGrid.replaceChildren(...paletteColors.map((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.color = color;
    button.title = color;
    button.style.background = color;
    return button;
  }));
  renderPaletteState();
}

function renderPaletteState() {
  const color = currentColorValue();
  els.activeColorPreview.classList.toggle("transparent-preview", color === "transparent");
  els.activeColorPreview.style.background = color === "transparent" ? "" : color;
  els.activeColorLabel.textContent = color === "transparent" ? "TRANSPARENT" : color.toUpperCase();
  els.colorGrid.querySelectorAll(".swatch").forEach((button) => {
    button.classList.toggle("active", button.dataset.color.toLowerCase() === color.toLowerCase());
  });
}

function screenToWorld(clientX, clientY) {
  const rect = els.workspace.getBoundingClientRect();
  const view = getDoc().view;
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  };
}

function applyViewport() {
  const view = getDoc().view;
  els.viewport.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.scale})`);
  els.zoomLabel.textContent = `${Math.round(view.scale * 100)}%`;
}

function addShape(type, point) {
  const size = type === "text" ? { width: 180, height: 54 } : { width: 160, height: 96 };
  const shape = {
    id: uid("shape"),
    type,
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
    width: size.width,
    height: size.height,
    text: type === "text" ? "Text" : labelForType(type),
    style: { ...defaultStyle },
  };
  getDoc().shapes.push(shape);
  setSelectedShapeIds([shape.id]);
  saveDocs();
  setTool("select");
  render();
  if (type === "text") openTextEditor(shape.id);
}

function labelForType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function shapeCenter(shape) {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function findShape(id) {
  return getDoc().shapes.find((shape) => shape.id === id);
}

function findConnection(id) {
  return getDoc().connections.find((connection) => connection.id === id);
}

function render() {
  const doc = getDoc();
  els.docTitle.value = doc.title;
  applyViewport();
  renderDocs();
  renderConnections();
  renderShapes();
  syncStyleControls();
  renderSelectionInfo();
}

function renderDocs() {
  els.docList.replaceChildren(...docs.map((doc) => {
    const row = document.createElement("div");
    row.className = "doc-row";
    row.classList.toggle("active", doc.id === activeDocId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doc-item";
    button.dataset.docId = doc.id;
    const title = document.createElement("span");
    title.textContent = doc.title || "Untitled diagram";
    const count = document.createElement("small");
    count.textContent = `${doc.shapes.length} items`;
    button.append(title, count);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "doc-delete";
    deleteButton.dataset.deleteDocId = doc.id;
    deleteButton.title = "Delete document";
    deleteButton.setAttribute("aria-label", `Delete ${doc.title || "Untitled diagram"}`);
    deleteButton.textContent = "x";
    row.append(button, deleteButton);
    return row;
  }));
}

function deleteDocument(docId) {
  const doc = docs.find((candidate) => candidate.id === docId);
  if (!doc) return;
  const title = doc.title || "Untitled diagram";
  if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
  docs = docs.filter((candidate) => candidate.id !== docId);
  if (!docs.length) {
    activeDocId = createDocument("Untitled diagram").id;
  } else if (activeDocId === docId) {
    activeDocId = docs[0].id;
  }
  selected = null;
  selectedShapeIds = [];
  editingShapeId = null;
  saveDocs();
  render();
}

function renderShapes() {
  const doc = getDoc();
  const nodes = doc.shapes.map((shape) => {
    const group = svg("g", {
      class: `shape-node${isSelected("shape", shape.id) ? " selected" : ""}`,
      "data-id": shape.id,
      transform: `translate(${shape.x} ${shape.y})`,
    });

    const body = createShapeBody(shape);
    group.append(body);

    if (editingShapeId === shape.id) {
      group.append(createShapeEditor(shape));
    } else {
      group.append(createShapeLabel(shape));
    }

    if (isSelected("shape", shape.id)) {
      group.append(svg("rect", {
        class: "resize-handle",
        x: shape.width - 6,
        y: shape.height - 6,
        width: 12,
        height: 12,
        rx: 2,
        "data-handle": "resize",
      }));
    }
    return group;
  });
  if (action?.type === "marquee") {
    const rect = normalizedRect(action.start, action.current);
    nodes.push(svg("rect", {
      class: "marquee-selection",
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
  }
  els.shapesLayer.replaceChildren(...nodes);
}

function createShapeEditor(shape) {
  const foreignObject = svg("foreignObject", {
    class: "shape-editor-host",
    x: 8,
    y: 8,
    width: Math.max(24, shape.width - 16),
    height: Math.max(24, shape.height - 16),
  });
  const textarea = document.createElementNS("http://www.w3.org/1999/xhtml", "textarea");
  textarea.className = "shape-inline-editor";
  textarea.value = shape.text;
  textarea.dataset.shapeId = shape.id;
  textarea.style.fontSize = `${shape.style.fontSize}px`;
  textarea.style.lineHeight = `${shape.style.fontSize * 1.2}px`;
  textarea.style.color = shape.style.text;
  textarea.addEventListener("pointerdown", (event) => event.stopPropagation());
  textarea.addEventListener("click", (event) => event.stopPropagation());
  textarea.addEventListener("dblclick", (event) => event.stopPropagation());
  textarea.addEventListener("input", updateInlineTextEditor);
  textarea.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      editingShapeId = null;
      render();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      commitTextEditor();
    }
  });
  foreignObject.append(textarea);
  return foreignObject;
}

function createShapeLabel(shape) {
  const lines = wrapText(shape.text, Math.max(1, shape.width - 18), shape.style.fontSize);
  const lineHeight = shape.style.fontSize * 1.2;
  const startY = shape.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const label = svg("text", {
    class: "shape-label",
    x: shape.width / 2,
    y: startY,
    fill: shape.style.text,
    "font-size": shape.style.fontSize,
  });
  lines.forEach((line, index) => {
    const tspan = svg("tspan", {
      x: shape.width / 2,
      dy: index === 0 ? 0 : lineHeight,
    });
    tspan.textContent = line;
    label.append(tspan);
  });
  return label;
}

function wrapText(text, maxWidth, fontSize) {
  const maxChars = Math.max(3, Math.floor(maxWidth / (fontSize * 0.56)));
  const sourceLines = String(text || " ").split(/\n/);
  const wrapped = [];
  sourceLines.forEach((sourceLine) => {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrapped.push(" ");
      return;
    }
    let line = "";
    words.forEach((word) => {
      if (word.length > maxChars) {
        if (line) wrapped.push(line);
        for (let i = 0; i < word.length; i += maxChars) wrapped.push(word.slice(i, i + maxChars));
        line = "";
        return;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        wrapped.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) wrapped.push(line);
  });
  return wrapped.slice(0, 8);
}

function createShapeBody(shape) {
  const common = {
    class: "shape-body",
    fill: shape.type === "text" ? "transparent" : shape.style.fill,
    stroke: shape.style.stroke,
    "stroke-width": shape.style.strokeWidth,
  };
  if (shape.type === "ellipse") {
    return svg("ellipse", {
      ...common,
      cx: shape.width / 2,
      cy: shape.height / 2,
      rx: shape.width / 2,
      ry: shape.height / 2,
    });
  }
  if (shape.type === "diamond") {
    return svg("polygon", {
      ...common,
      points: `${shape.width / 2},0 ${shape.width},${shape.height / 2} ${shape.width / 2},${shape.height} 0,${shape.height / 2}`,
    });
  }
  return svg("rect", {
    ...common,
    width: shape.width,
    height: shape.height,
    rx: shape.type === "text" ? 4 : 8,
  });
}

function renderConnections() {
  const doc = getDoc();
  const nodes = doc.connections.map((connection) => {
    const from = findShape(connection.from);
    const to = findShape(connection.to);
    if (!from || !to) return null;
    const [a, b] = connectionEndpoints(from, to);
    const hitLine = svg("line", {
      class: "connection-hit",
      "data-id": connection.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
    });
    const attrs = {
      class: `connection-line${isSelected("connection", connection.id) ? " selected" : ""}`,
      "data-id": connection.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: connection.style.stroke,
      "stroke-width": connection.style.strokeWidth,
    };
    if (connectionHasArrow(connection, "start")) attrs["marker-start"] = "url(#arrow)";
    if (connectionHasArrow(connection, "end")) attrs["marker-end"] = "url(#arrow)";
    const line = svg("line", attrs);
    const group = svg("g", {
      class: "connection-node",
      "data-id": connection.id,
    });
    group.append(hitLine, line);
    return group;
  }).filter(Boolean);

  if (draftConnection) {
    nodes.push(svg("line", {
      class: "connector-preview",
      x1: draftConnection.from.x,
      y1: draftConnection.from.y,
      x2: draftConnection.to.x,
      y2: draftConnection.to.y,
    }));
  }
  els.connectionsLayer.replaceChildren(...nodes);
}

function connectionEndpoints(from, to) {
  const a = shapeCenter(from);
  const b = shapeCenter(to);
  return [shapeEdgePoint(from, b), shapeEdgePoint(to, a)];
}

function shapeEdgePoint(shape, toward) {
  const center = shapeCenter(shape);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;

  if (shape.type === "ellipse") {
    const scale = 1 / Math.sqrt((dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH));
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  }

  if (shape.type === "diamond") {
    const scale = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH);
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  }

  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function connectionHasArrow(connection, side) {
  if (side === "start") return Boolean(connection.style.arrowStart);
  return connection.style.arrowEnd !== false;
}

function normalizedRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function rectContainsShape(rect, shape) {
  return shape.x >= rect.x
    && shape.y >= rect.y
    && shape.x + shape.width <= rect.x + rect.width
    && shape.y + shape.height <= rect.y + rect.height;
}

function svg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function isSelected(type, id) {
  if (type === "shape") return selectedShapeIds.includes(id);
  return selected?.type === type && selected.id === id;
}

function setSelectedShapeIds(ids) {
  selectedShapeIds = [...new Set(ids)];
  selected = selectedShapeIds.length ? { type: "shape", id: selectedShapeIds[0] } : null;
}

function syncStyleControls() {
  const target = selected?.type === "shape" ? findShape(selected.id) : selected?.type === "connection" ? findConnection(selected.id) : null;
  const style = target?.style || defaultStyle;
  if ((style.fill ?? defaultStyle.fill) !== "transparent") els.fillColor.value = style.fill ?? defaultStyle.fill;
  if ((style.stroke ?? defaultStyle.stroke) !== "transparent") els.strokeColor.value = style.stroke ?? defaultStyle.stroke;
  if ((style.text ?? defaultStyle.text) !== "transparent") els.textColor.value = style.text ?? defaultStyle.text;
  els.strokeWidth.value = style.strokeWidth || defaultStyle.strokeWidth;
  els.strokeWidthValue.textContent = els.strokeWidth.value;
  els.fontSize.value = style.fontSize || defaultStyle.fontSize;
  els.fontSizeValue.textContent = els.fontSize.value;
  const connection = selected?.type === "connection" ? findConnection(selected.id) : null;
  els.arrowStart.checked = connection ? connectionHasArrow(connection, "start") : Boolean(defaultStyle.arrowStart);
  els.arrowEnd.checked = connection ? connectionHasArrow(connection, "end") : defaultStyle.arrowEnd !== false;
  renderPaletteState();
}

function renderSelectionInfo() {
  if (!selected) {
    els.selectionInfo.textContent = "Nothing selected";
    els.shapeTextField.hidden = true;
    els.shapeTextInput.value = "";
    return;
  }
  if (selected.type === "shape") {
    const shape = findShape(selected.id);
    els.selectionInfo.textContent = shape
      ? selectedShapeIds.length > 1
        ? `${selectedShapeIds.length} shapes selected`
        : `${labelForType(shape.type)}: ${Math.round(shape.width)} x ${Math.round(shape.height)}`
      : "Nothing selected";
    els.shapeTextField.hidden = !shape;
    els.shapeTextInput.value = shape?.text || "";
    return;
  }
  els.selectionInfo.textContent = "Connector selected";
  els.shapeTextField.hidden = true;
  els.shapeTextInput.value = "";
}

function updateSelectedShapeText(text) {
  if (selected?.type !== "shape") return;
  const shape = findShape(selected.id);
  if (!shape) return;
  shape.text = text || " ";
  saveDocs();
  if (editingShapeId === shape.id) {
    const editor = els.shapesLayer.querySelector(`.shape-inline-editor[data-shape-id="${CSS.escape(shape.id)}"]`);
    if (editor && editor.value !== text) editor.value = text;
  }
  renderShapes();
  renderConnections();
}

function updateSelectedStyle(patch) {
  if (!selected) {
    Object.assign(defaultStyle, patch);
    syncStyleControls();
    return;
  }
  if (selected.type === "shape") {
    const targets = selectedShapeIds.length ? selectedShapeIds.map(findShape).filter(Boolean) : [findShape(selected.id)].filter(Boolean);
    targets.forEach((target) => {
      target.style = { ...target.style, ...patch };
    });
    saveDocs();
    render();
    return;
  }
  const target = selected.type === "shape" ? findShape(selected.id) : findConnection(selected.id);
  if (!target) return;
  target.style = { ...target.style, ...patch };
  saveDocs();
  render();
}

function updateArrowStyle(patch) {
  if (selected?.type === "connection") {
    const connection = findConnection(selected.id);
    if (!connection) return;
    connection.style = { ...connection.style, ...patch };
    saveDocs();
    render();
    return;
  }
  Object.assign(defaultStyle, patch);
  syncStyleControls();
}

function deleteSelected() {
  if (!selected) return;
  const doc = getDoc();
  if (selected.type === "shape") {
    const ids = new Set(selectedShapeIds.length ? selectedShapeIds : [selected.id]);
    doc.shapes = doc.shapes.filter((shape) => !ids.has(shape.id));
    doc.connections = doc.connections.filter((connection) => !ids.has(connection.from) && !ids.has(connection.to));
  } else {
    doc.connections = doc.connections.filter((connection) => connection.id !== selected.id);
  }
  selected = null;
  selectedShapeIds = [];
  saveDocs();
  render();
}

function openTextEditor(shapeId) {
  const shape = findShape(shapeId);
  if (!shape) return;
  setSelectedShapeIds([shapeId]);
  editingShapeId = shapeId;
  render();
  window.setTimeout(() => {
    const editor = els.shapesLayer.querySelector(`.shape-inline-editor[data-shape-id="${CSS.escape(shapeId)}"]`);
    if (!editor) return;
    editor.focus();
    editor.select();
  }, 0);
}

function commitTextEditor() {
  if (!editingShapeId) return;
  const editor = els.shapesLayer.querySelector(`.shape-inline-editor[data-shape-id="${CSS.escape(editingShapeId)}"]`);
  const shape = findShape(editingShapeId);
  if (shape && editor) {
    shape.text = editor.value || " ";
    saveDocs();
  }
  editingShapeId = null;
  render();
}

function updateInlineTextEditor(event) {
  const editor = event.target;
  const shape = findShape(editor.dataset.shapeId);
  if (!shape) return;
  shape.text = editor.value || " ";
  saveDocs();
  if (selected?.type === "shape" && selected.id === shape.id) {
    els.shapeTextInput.value = shape.text;
  }
}

function cancelDraftConnection() {
  draftConnection = null;
}

function onPointerDown(event) {
  const shapeNode = event.target.closest?.(".shape-node");
  const connectionNode = event.target.closest?.(".connection-node, .connection-line, .connection-hit");
  const now = Date.now();
  const isFastRepeatShapeClick = shapeNode
    && lastShapeClick.id === shapeNode.dataset.id
    && now - lastShapeClick.time < 500;
  if (shapeNode) {
    lastShapeClick = { id: shapeNode.dataset.id, time: now };
  } else {
    lastShapeClick = { id: null, time: 0 };
  }

  if (shapeNode && tool === "select" && (event.detail >= 2 || isFastRepeatShapeClick)) {
    event.preventDefault();
    event.stopPropagation();
    action = null;
    openTextEditor(shapeNode.dataset.id);
    return;
  }

  commitTextEditor();
  els.workspace.focus();
  const doc = getDoc();
  const point = screenToWorld(event.clientX, event.clientY);
  const shouldPan = tool === "pan" || spaceDown || event.button === 1;

  if (shouldPan) {
    action = { type: "pan", startX: event.clientX, startY: event.clientY, view: { ...doc.view } };
    els.workspace.classList.add("is-dragging");
    els.workspace.setPointerCapture(event.pointerId);
    return;
  }

  if (tool === "connector") {
    if (shapeNode) {
      const shape = findShape(shapeNode.dataset.id);
      const center = shapeCenter(shape);
      draftConnection = { fromShape: shape.id, from: center, to: point };
      action = { type: "connect" };
      els.workspace.setPointerCapture(event.pointerId);
      render();
    }
    return;
  }

  if (["rect", "ellipse", "diamond", "text"].includes(tool)) {
    addShape(tool, point);
    return;
  }

  if (shapeNode) {
    const id = shapeNode.dataset.id;
    if (!selectedShapeIds.includes(id)) {
      setSelectedShapeIds(event.shiftKey ? [...selectedShapeIds, id] : [id]);
    }
    const shape = findShape(id);
    const resize = event.target.dataset.handle === "resize";
    const moveIds = resize ? [id] : selectedShapeIds.filter((shapeId) => findShape(shapeId));
    const positions = Object.fromEntries(moveIds.map((shapeId) => {
      const selectedShape = findShape(shapeId);
      return [shapeId, { x: selectedShape.x, y: selectedShape.y }];
    }));
    action = resize
      ? { type: "resize", id, start: point, width: shape.width, height: shape.height }
      : { type: "move", ids: moveIds, start: point, positions };
    els.workspace.setPointerCapture(event.pointerId);
    render();
    return;
  }

  if (connectionNode) {
    selected = { type: "connection", id: connectionNode.dataset.id };
    selectedShapeIds = [];
    render();
    return;
  }

  if (tool === "select") {
    setSelectedShapeIds([]);
    action = { type: "marquee", start: point, current: point };
    els.workspace.setPointerCapture(event.pointerId);
    render();
    return;
  }

  selected = null;
  selectedShapeIds = [];
  render();
}

function onPointerMove(event) {
  if (!action) return;
  const doc = getDoc();
  if (action.type === "pan") {
    doc.view.x = action.view.x + event.clientX - action.startX;
    doc.view.y = action.view.y + event.clientY - action.startY;
    applyViewport();
    return;
  }

  const point = screenToWorld(event.clientX, event.clientY);
  if (action.type === "move") {
    action.ids.forEach((id) => {
      const shape = findShape(id);
      const start = action.positions[id];
      if (!shape || !start) return;
      shape.x = start.x + point.x - action.start.x;
      shape.y = start.y + point.y - action.start.y;
    });
    renderShapes();
    renderConnections();
    return;
  }
  if (action.type === "resize") {
    const shape = findShape(action.id);
    shape.width = Math.max(40, action.width + point.x - action.start.x);
    shape.height = Math.max(28, action.height + point.y - action.start.y);
    render();
    return;
  }
  if (action.type === "connect" && draftConnection) {
    draftConnection.to = point;
    renderConnections();
  }
  if (action.type === "marquee") {
    action.current = point;
    renderShapes();
  }
}

function onPointerUp(event) {
  if (!action) return;
  if (action.type === "marquee") {
    const rect = normalizedRect(action.start, action.current);
    const ids = getDoc().shapes
      .filter((shape) => rectContainsShape(rect, shape))
      .map((shape) => shape.id);
    setSelectedShapeIds(ids);
  }
  if (action.type === "connect" && draftConnection) {
    const targetNode = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".shape-node");
    if (targetNode && targetNode.dataset.id !== draftConnection.fromShape) {
      getDoc().connections.push({
        id: uid("conn"),
        from: draftConnection.fromShape,
        to: targetNode.dataset.id,
        style: {
          stroke: defaultStyle.stroke,
          strokeWidth: defaultStyle.strokeWidth,
          arrowStart: Boolean(defaultStyle.arrowStart),
          arrowEnd: defaultStyle.arrowEnd !== false,
        },
      });
      selected = { type: "connection", id: getDoc().connections[getDoc().connections.length - 1].id };
      selectedShapeIds = [];
    }
    cancelDraftConnection();
  }
  saveDocs();
  action = null;
  els.workspace.classList.remove("is-dragging");
  try {
    els.workspace.releasePointerCapture(event.pointerId);
  } catch (_) {}
  render();
}

function onWheel(event) {
  event.preventDefault();
  commitTextEditor();
  const doc = getDoc();
  const before = screenToWorld(event.clientX, event.clientY);
  const factor = event.deltaY < 0 ? 1.08 : 0.92;
  doc.view.scale = Math.min(3, Math.max(0.2, doc.view.scale * factor));
  const rect = els.workspace.getBoundingClientRect();
  doc.view.x = event.clientX - rect.left - before.x * doc.view.scale;
  doc.view.y = event.clientY - rect.top - before.y * doc.view.scale;
  saveDocs();
  render();
}

function exportDocument() {
  commitTextEditor();
  const doc = getDoc();
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${filenameBase(doc)}.json`);
}

function filenameBase(doc) {
  return (doc.title || "diagram").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "diagram";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportSvgDocument() {
  commitTextEditor();
  const doc = getDoc();
  const svgText = buildExportSvg(doc);
  downloadBlob(new Blob([svgText], { type: "image/svg+xml" }), `${filenameBase(doc)}.svg`);
}

function exportPngDocument() {
  commitTextEditor();
  const doc = getDoc();
  const svgText = buildExportSvg(doc);
  const bounds = diagramBounds(doc);
  const image = new Image();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(bounds.width));
    canvas.height = Math.max(1, Math.ceil(bounds.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${filenameBase(doc)}.png`);
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert("PNG export failed. Try SVG export instead.");
  };
  image.src = url;
}

function buildExportSvg(doc) {
  const bounds = diagramBounds(doc);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">`,
    "<defs>",
    `<marker id="export-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="context-stroke"/></marker>`,
    "</defs>",
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#ffffff"/>`,
  ];

  doc.connections.forEach((connection) => {
    const from = doc.shapes.find((shape) => shape.id === connection.from);
    const to = doc.shapes.find((shape) => shape.id === connection.to);
    if (!from || !to) return;
    const [a, b] = connectionEndpointsForShapes(from, to);
    const startMarker = connectionHasArrow(connection, "start") ? ` marker-start="url(#export-arrow)"` : "";
    const endMarker = connectionHasArrow(connection, "end") ? ` marker-end="url(#export-arrow)"` : "";
    parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" fill="none" stroke="${escapeAttr(connection.style.stroke)}" stroke-width="${connection.style.strokeWidth}"${startMarker}${endMarker}/>`);
  });

  doc.shapes.forEach((shape) => {
    parts.push(shapeToSvg(shape));
  });

  parts.push("</svg>");
  return parts.join("");
}

function diagramBounds(doc) {
  if (!doc.shapes.length) return { x: 0, y: 0, width: 1000, height: 700 };
  const pad = 48;
  const minX = Math.min(...doc.shapes.map((shape) => shape.x)) - pad;
  const minY = Math.min(...doc.shapes.map((shape) => shape.y)) - pad;
  const maxX = Math.max(...doc.shapes.map((shape) => shape.x + shape.width)) + pad;
  const maxY = Math.max(...doc.shapes.map((shape) => shape.y + shape.height)) + pad;
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
}

function connectionEndpointsForShapes(from, to) {
  const a = {
    x: from.x + from.width / 2,
    y: from.y + from.height / 2,
  };
  const b = {
    x: to.x + to.width / 2,
    y: to.y + to.height / 2,
  };
  return [shapeEdgePoint(from, b), shapeEdgePoint(to, a)];
}

function shapeToSvg(shape) {
  const style = shape.style;
  const fill = shape.type === "text" ? "transparent" : style.fill;
  const common = `fill="${escapeAttr(fill)}" stroke="${escapeAttr(style.stroke)}" stroke-width="${style.strokeWidth}"`;
  let body = "";
  if (shape.type === "ellipse") {
    body = `<ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" ${common}/>`;
  } else if (shape.type === "diamond") {
    const points = `${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height / 2} ${shape.x + shape.width / 2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height / 2}`;
    body = `<polygon points="${points}" ${common}/>`;
  } else {
    body = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.type === "text" ? 4 : 8}" ${common}/>`;
  }

  const lines = wrapText(shape.text, Math.max(1, shape.width - 18), style.fontSize);
  const lineHeight = style.fontSize * 1.2;
  const startY = shape.y + shape.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines.map((line, index) => {
    const y = startY + index * lineHeight;
    return `<tspan x="${shape.x + shape.width / 2}" y="${y}">${escapeText(line)}</tspan>`;
  }).join("");
  const label = `<text fill="${escapeAttr(style.text)}" font-family="Inter, Arial, sans-serif" font-size="${style.fontSize}" text-anchor="middle" dominant-baseline="middle">${tspans}</text>`;
  return `${body}${label}`;
}

function escapeText(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function importDocument(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.shapes) || !Array.isArray(imported.connections)) {
        throw new Error("Not a diagram document");
      }
      imported.id = uid("doc");
      imported.title = imported.title ? `${imported.title} (imported)` : "Imported diagram";
      imported.updatedAt = Date.now();
      imported.view = imported.view || { x: 360, y: 220, scale: 1 };
      docs.unshift(imported);
      activeDocId = imported.id;
      selected = null;
      selectedShapeIds = [];
      saveDocs();
      render();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      els.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

document.querySelectorAll(".color-tab").forEach((button) => {
  button.addEventListener("click", () => setActiveColorTarget(button.dataset.colorTarget));
});

els.colorGrid.addEventListener("click", (event) => {
  const swatch = event.target.closest(".swatch");
  if (!swatch) return;
  applyColor(activeColorTarget, swatch.dataset.color);
});
els.transparentColorBtn.addEventListener("click", () => applyColor(activeColorTarget, "transparent"));

els.workspace.addEventListener("pointerdown", onPointerDown);
els.workspace.addEventListener("pointermove", onPointerMove);
els.workspace.addEventListener("pointerup", onPointerUp);
els.workspace.addEventListener("pointercancel", onPointerUp);
els.workspace.addEventListener("wheel", onWheel, { passive: false });
els.workspace.addEventListener("dblclick", (event) => {
  const shapeNode = event.target.closest?.(".shape-node");
  if (shapeNode) {
    event.preventDefault();
    event.stopPropagation();
  }
});

els.docTitle.addEventListener("input", () => {
  getDoc().title = els.docTitle.value;
  saveDocs();
  renderDocs();
});

els.docList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-doc-id]");
  if (deleteButton) {
    deleteDocument(deleteButton.dataset.deleteDocId);
    return;
  }
  const button = event.target.closest(".doc-item");
  if (!button) return;
  commitTextEditor();
  activeDocId = button.dataset.docId;
  selected = null;
  selectedShapeIds = [];
  render();
});

document.getElementById("newDocBtn").addEventListener("click", () => {
  activeDocId = createDocument("Untitled diagram").id;
  selected = null;
  selectedShapeIds = [];
  render();
});

document.getElementById("duplicateDocBtn").addEventListener("click", () => {
  const copy = JSON.parse(JSON.stringify(getDoc()));
  copy.id = uid("doc");
  copy.title = `${copy.title || "Untitled diagram"} copy`;
  copy.updatedAt = Date.now();
  docs.unshift(copy);
  activeDocId = copy.id;
  selected = null;
  selectedShapeIds = [];
  saveDocs();
  render();
});

document.getElementById("exportBtn").addEventListener("click", exportDocument);
document.getElementById("exportSvgBtn").addEventListener("click", exportSvgDocument);
document.getElementById("exportPngBtn").addEventListener("click", exportPngDocument);
els.importInput.addEventListener("change", () => {
  const file = els.importInput.files?.[0];
  if (file) importDocument(file);
});

els.deleteBtn.addEventListener("click", deleteSelected);
els.shapeTextInput.addEventListener("input", () => updateSelectedShapeText(els.shapeTextInput.value));
els.fillColor.addEventListener("input", () => applyColor("fill", els.fillColor.value));
els.strokeColor.addEventListener("input", () => applyColor("stroke", els.strokeColor.value));
els.textColor.addEventListener("input", () => applyColor("text", els.textColor.value));
els.strokeWidth.addEventListener("input", () => updateSelectedStyle({ strokeWidth: Number(els.strokeWidth.value) }));
els.fontSize.addEventListener("input", () => updateSelectedStyle({ fontSize: Number(els.fontSize.value) }));
els.arrowStart.addEventListener("change", () => updateArrowStyle({ arrowStart: els.arrowStart.checked }));
els.arrowEnd.addEventListener("change", () => updateArrowStyle({ arrowEnd: els.arrowEnd.checked }));

window.addEventListener("keydown", (event) => {
  if (event.target.closest?.(".shape-inline-editor") || event.target === els.docTitle || event.target === els.shapeTextInput) return;
  if (event.code === "Space") {
    spaceDown = true;
    els.workspace.classList.add("is-panning");
    event.preventDefault();
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelected();
  }
  if (event.key === "v") setTool("select");
  if (event.key === "h") setTool("pan");
  if (event.key === "c") setTool("connector");
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    spaceDown = false;
    els.workspace.classList.remove("is-panning");
  }
});

window.addEventListener("resize", render);

renderPalette();
setActiveColorTarget("fill");
render();
