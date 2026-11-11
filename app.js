/* Prototipo RF WEP — Ingreso masivo de seriales por foto/archivo
   Un solo flujo: Recibo Simple · serial_masive_receipt ON · producto con seriales · carga exitosa. */
(function () {
  "use strict";

  var TARGET_QTY = 5;
  var PRODUCT = {
    sku: "SER-88410",
    huella: "STD",
    estatus: "Disponible"
  };

  var els = {
    stepList: document.getElementById("stepList"),
    messageZone: document.getElementById("messageZone"),
    promptZone: document.getElementById("promptZone"),
    footerZone: document.getElementById("footerZone"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    modalHost: document.getElementById("modalHost"),
    systemHost: document.getElementById("systemHost"),
    fileInput: document.getElementById("fileInput")
  };

  var state = null;
  var toastTimer = null;
  var processTimer = null;

  function defaults() {
    return {
      stage: "folio",
      rows: [{ label: "Tipo de recibo", value: "Recibo simple" }],
      folio: "KAR1026",
      lpn: "LPN0001",
      cantidad: TARGET_QTY,
      serials: [],
      selectedSerials: {},
      serialsOpen: false,
      massiveMode: false,
      captureView: null,
      pendingFile: null,
      message: null
    };
  }

  function remaining() {
    return Math.max(0, state.cantidad - state.serials.length);
  }

  function counterLabel() {
    return state.serials.length + " de " + state.cantidad;
  }

  function showToast(html, tone) {
    els.toastText.innerHTML = html;
    els.toast.classList.remove("is-success", "is-info");
    if (tone === "success") {
      els.toast.classList.add("is-success");
      els.toast.querySelector(".toast-icon").src = "icon-check-step.svg";
    } else {
      els.toast.classList.add("is-info");
      els.toast.querySelector(".toast-icon").src = "icon-info.svg";
    }
    els.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.hidden = true;
      els.toast.classList.remove("is-success", "is-info");
    }, 3600);
  }

  function clearModal() {
    els.modalHost.innerHTML = "";
  }

  function clearSystem() {
    els.systemHost.innerHTML = "";
  }

  function rowHtml(row) {
    return (
      '<div class="step-row">' +
        '<p class="step-text">' + row.label + ": <strong>" + row.value + "</strong></p>" +
        '<img class="step-check" src="icon-check-step.svg" alt="Confirmado">' +
      "</div>"
    );
  }

  function messageBlock(msg) {
    var icon = msg.pi
      ? '<i class="pi ' + msg.pi + ' message-icon" aria-hidden="true"></i>'
      : '<img class="message-icon" src="' + msg.icon + '" alt="">';
    return (
      '<section class="message ' + msg.tone + '" aria-live="polite">' +
        '<div class="message-head">' +
          icon +
          '<p class="message-title">' + msg.html + "</p>" +
        "</div>" +
      "</section>"
    );
  }

  function promptField(id, label, placeholder, value) {
    var labelHtml = label
      ? '<p class="prompt-label" id="' + id + 'Label">' + label + "</p>"
      : "";
    var labelledBy = label ? ' aria-labelledby="' + id + 'Label"' : ' aria-label="' + (placeholder || id) + '"';
    return (
      '<div class="prompt-block">' +
        labelHtml +
        '<input class="control is-prompt" id="' + id + '" type="text" ' +
          'placeholder="' + (placeholder || "") + '" ' +
          'value="' + (value || "") + '" autocomplete="off"' + labelledBy + ">" +
      "</div>"
    );
  }

  function bindEnter(id, handler) {
    var input = document.getElementById(id);
    if (!input) return;
    input.focus();
    input.select();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handler(input.value.trim());
      }
    });
  }

  function confirmRow(label, value) {
    state.rows.push({ label: label, value: value });
  }

  function mockOcrSerials() {
    var need = remaining() || state.cantidad;
    var base = 1000 + state.serials.length * 10;
    var list = [];
    for (var i = 0; i < need; i++) {
      list.push("SN-" + (base + i + 1));
    }
    return list;
  }

  function applyMassiveSuccess(serials) {
    state.captureView = null;
    state.pendingFile = null;
    state.massiveMode = false;
    state.message = null;

    serials.forEach(function (s) {
      state.serials.push(s);
    });

    if (state.serials.length >= state.cantidad) {
      finishSerials();
      return;
    }

    state.stage = "seriales";
    render();
    showToast(
      "<strong>Seriales procesados.</strong> Se ingresaron " + serials.length +
        ". Contador: " + counterLabel() + ".",
      "success"
    );
  }

  function finishSerials() {
    state.message = null;
    state.stage = "done";
    state.massiveMode = false;
    state.captureView = null;
    render();
    showToast(
      "<strong>Seriales procesados.</strong> Se ingresaron " +
        counterLabel() + " correctamente.",
      "success"
    );
  }

  function serialsComplete() {
    return state.serials.length >= state.cantidad && state.cantidad > 0;
  }

  function canManageSerials() {
    return state.stage === "seriales" || state.stage === "done";
  }

  function revertFromDoneIfIncomplete() {
    if (state.stage !== "done" || serialsComplete()) return;
    state.stage = "seriales";
    state.message = null;
  }

  function selectedSerialValues() {
    return state.serials.filter(function (s) {
      return !!state.selectedSerials[s];
    });
  }

  function selectedCount() {
    return selectedSerialValues().length;
  }

  function allSerialsSelected() {
    return state.serials.length > 0 && selectedCount() === state.serials.length;
  }

  function pruneSerialSelection() {
    var next = {};
    state.serials.forEach(function (s) {
      if (state.selectedSerials[s]) next[s] = true;
    });
    state.selectedSerials = next;
  }

  function removeSelectedSerials() {
    if (!canManageSerials()) return;
    var selected = selectedSerialValues();
    if (!selected.length) return;
    state.serials = state.serials.filter(function (s) {
      return !state.selectedSerials[s];
    });
    state.selectedSerials = {};
    state.serialsOpen = true;
    revertFromDoneIfIncomplete();
    render();
  }

  function confirmRemoveSerials(opts) {
    var title = opts.title || "Cancelar serial";
    var copy = opts.copy || "¿Estás seguro que deseas cancelar este serial?";
    var confirmLabel = opts.confirmLabel || "Cancelar serial";
    var onYes = opts.onYes;

    els.modalHost.innerHTML =
      '<div class="overlay" id="removeOverlay"></div>' +
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="removeTitle">' +
        '<div class="modal-head">' +
          '<h2 class="modal-title" id="removeTitle">' + title + "</h2>" +
          '<button class="modal-close" id="removeClose" type="button" aria-label="Cerrar">' +
            '<img src="icon-close.svg" alt="">' +
          "</button>" +
        "</div>" +
        '<p class="modal-copy">' + copy + "</p>" +
        '<div class="modal-actions confirm-actions">' +
          '<button class="btn btn-ghost" type="button" id="removeNo">Regresar</button>' +
          '<button class="btn btn-danger" type="button" id="removeYes">' + confirmLabel + "</button>" +
        "</div>" +
      "</div>";

    function close() {
      clearModal();
    }

    document.getElementById("removeClose").addEventListener("click", close);
    document.getElementById("removeOverlay").addEventListener("click", close);
    document.getElementById("removeNo").addEventListener("click", close);
    document.getElementById("removeYes").addEventListener("click", function () {
      clearModal();
      onYes();
    });
  }

  function serialsCardHtml() {
    var open = !!state.serialsOpen;
    var complete = serialsComplete();
    var editable = canManageSerials();
    var selected = selectedCount();
    var allSelected = allSerialsSelected();
    var statusLabel = complete
      ? "Completos"
      : state.serials.length
        ? "Pendientes"
        : "Sin seriales";
    var items = state.serials.length
      ? state.serials.map(function (s, i) {
          var checked = !!state.selectedSerials[s];
          return (
            '<li class="serial-item' + (checked ? " is-selected" : "") + '">' +
              (editable
                ? '<label class="serial-check">' +
                    '<input type="checkbox" data-select-serial="' + s + '"' + (checked ? " checked" : "") + ">" +
                    '<span class="serial-check-box" aria-hidden="true"></span>' +
                  "</label>"
                : "") +
              '<span class="serial-item-text">Serial ' + (i + 1) + ": <strong>" + s + "</strong></span>" +
              (editable
                ? '<button class="serial-item-remove" type="button" data-remove-serial="' + i + '" aria-label="Cancelar serial ' + (i + 1) + '">' +
                    '<i class="pi pi-times" aria-hidden="true"></i>' +
                  "</button>"
                : "") +
            "</li>"
          );
        }).join("")
      : '<li class="serial-empty">Aún no hay seriales registrados.</li>';

    var partialSelected = selected > 0 && !allSelected;
    var toolbar = "";
    if (editable && state.serials.length) {
      toolbar =
        '<div class="serials-select-bar">' +
          '<label class="serial-check is-all' + (partialSelected ? " is-indeterminate" : "") + '">' +
            '<input type="checkbox" id="selectAllSerials"' +
              (allSelected ? " checked" : "") +
              (partialSelected ? ' data-indeterminate="true"' : "") +
            ">" +
            '<span class="serial-check-box" aria-hidden="true"></span>' +
            "<span>Seleccionar todos</span>" +
          "</label>" +
          (selected
            ? '<span class="serials-selected-count">' + selected + " seleccionados</span>"
            : "") +
        "</div>";
    }

    var actions = editable && selected
      ? '<div class="serials-card-actions">' +
          '<button class="btn btn-danger" type="button" id="btnCancelSelected">' +
            (selected === 1 ? "Cancelar serial" : "Cancelar seriales") +
          "</button>" +
        "</div>"
      : "";

    return (
      '<section class="serials-card' + (open ? " is-open" : "") + (complete ? " is-complete" : "") +
        '" aria-label="Seriales ingresados">' +
        '<button class="serials-card-toggle" type="button" id="btnToggleSerials" ' +
          'aria-expanded="' + (open ? "true" : "false") + '" aria-controls="serialsCardBody">' +
          '<div class="serials-card-summary">' +
            '<span class="serials-card-label">Seriales ingresados</span>' +
            '<div class="serials-card-meta">' +
              '<strong class="serials-card-count" aria-live="polite">' + counterLabel() + "</strong>" +
              '<span class="serials-card-status">' + statusLabel + "</span>" +
            "</div>" +
          "</div>" +
          '<i class="pi ' + (open ? "pi-chevron-up" : "pi-chevron-down") + ' serials-card-chevron" aria-hidden="true"></i>' +
        "</button>" +
        '<div class="serials-card-body" id="serialsCardBody"' + (open ? "" : " hidden") + ">" +
          toolbar +
          '<ul class="serial-list">' + items + "</ul>" +
          actions +
        "</div>" +
      "</section>"
    );
  }

  function bindSerialsCard() {
    pruneSerialSelection();

    var toggleBtn = document.getElementById("btnToggleSerials");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        state.serialsOpen = !state.serialsOpen;
        render();
        if (state.stage === "seriales" && state.massiveMode) {
          if (state.captureView === "camera") showAndroidCamera();
          else showMassiveModal();
        }
      });
    }

    document.querySelectorAll("[data-select-serial]").forEach(function (input) {
      input.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      input.addEventListener("change", function (e) {
        e.stopPropagation();
        var value = input.getAttribute("data-select-serial");
        if (input.checked) state.selectedSerials[value] = true;
        else delete state.selectedSerials[value];
        state.serialsOpen = true;
        render();
      });
    });

    var selectAll = document.getElementById("selectAllSerials");
    if (selectAll) {
      selectAll.indeterminate = selectAll.getAttribute("data-indeterminate") === "true";
      selectAll.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      selectAll.addEventListener("change", function (e) {
        e.stopPropagation();
        // Desde indeterminado, el primer tap debe seleccionar todos
        if (selectAll.indeterminate || selectAll.checked) {
          state.serials.forEach(function (s) {
            state.selectedSerials[s] = true;
          });
        } else {
          state.selectedSerials = {};
        }
        state.serialsOpen = true;
        render();
      });
    }

    document.querySelectorAll("[data-remove-serial]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var index = parseInt(btn.getAttribute("data-remove-serial"), 10);
        var value = state.serials[index];
        confirmRemoveSerials({
          title: "Cancelar serial",
          copy: "¿Estás seguro que deseas cancelar el serial <strong>" + value + "</strong>?",
          confirmLabel: "Cancelar serial",
          onYes: function () {
            if (!canManageSerials() || index < 0 || index >= state.serials.length) return;
            var removed = state.serials[index];
            state.serials.splice(index, 1);
            if (removed) delete state.selectedSerials[removed];
            state.serialsOpen = true;
            revertFromDoneIfIncomplete();
            render();
          }
        });
      });
    });

    var cancelSelected = document.getElementById("btnCancelSelected");
    if (cancelSelected) {
      cancelSelected.addEventListener("click", function (e) {
        e.stopPropagation();
        var selected = selectedSerialValues();
        var plural = selected.length > 1;
        confirmRemoveSerials({
          title: plural ? "Cancelar seriales" : "Cancelar serial",
          copy: plural
            ? "¿Estás seguro que deseas cancelar <strong>" + selected.length + " seriales</strong> seleccionados?"
            : "¿Estás seguro que deseas cancelar el serial <strong>" + selected[0] + "</strong>?",
          confirmLabel: plural ? "Cancelar seriales" : "Cancelar serial",
          onYes: removeSelectedSerials
        });
      });
    }
  }

  function closeMassiveModal() {
    state.massiveMode = false;
    state.captureView = null;
    state.pendingFile = null;
    clearSystem();
    clearModal();
    render();
  }

  function massiveModalBody() {
    if (state.captureView === "processing") {
      return (
        '<div class="processing is-modal">' +
          '<div class="spinner" aria-hidden="true"></div>' +
          "<span>WEP procesa la imagen con el modelo de identificación de seriales…</span>" +
        "</div>"
      );
    }

    return (
      '<p class="modal-copy">Selecciona un archivo de imagen o toma una foto.</p>' +
      '<div class="capture-choices">' +
        '<button class="capture-choice" type="button" id="btnPickFile">' +
          '<i class="pi pi-image" aria-hidden="true"></i>' +
          "<strong>Cargar imagen</strong>" +
          "<span>Máximo 25 MB</span>" +
        "</button>" +
        '<button class="capture-choice" type="button" id="btnOpenCamera">' +
          '<i class="pi pi-camera" aria-hidden="true"></i>' +
          "<strong>Tomar foto</strong>" +
          "<span>Cámara del dispositivo</span>" +
        "</button>" +
      "</div>"
    );
  }

  function showAndroidCamera() {
    state.captureView = "camera";
    clearModal();
    els.systemHost.innerHTML =
      '<div class="android-camera" role="dialog" aria-modal="true" aria-label="Cámara de Android">' +
        '<div class="android-camera-status" aria-hidden="true">' +
          '<span>12:40</span>' +
          '<span class="android-camera-status-icons">5G · 82%</span>' +
        "</div>" +
        '<div class="android-camera-viewfinder">' +
          '<div class="android-camera-grid" aria-hidden="true"></div>' +
          '<p class="android-camera-hint">Encuadre la papeleta con los seriales</p>' +
        "</div>" +
        '<div class="android-camera-controls">' +
          '<button class="android-cam-back" type="button" id="androidCamBack">Volver</button>' +
          '<button class="android-cam-shutter" type="button" id="androidCamShoot" aria-label="Capturar">' +
            '<span class="android-cam-shutter-ring"></span>' +
          "</button>" +
          '<span class="android-cam-spacer" aria-hidden="true"></span>' +
        "</div>" +
      "</div>";

    document.getElementById("androidCamBack").addEventListener("click", function () {
      state.captureView = null;
      clearSystem();
      showMassiveModal();
    });

    document.getElementById("androidCamShoot").addEventListener("click", function () {
      clearSystem();
      startProcessing("foto");
    });
  }

  function showMassiveModal() {
    var canClose = state.captureView !== "processing";
    clearSystem();

    els.modalHost.innerHTML =
      '<div class="overlay" id="massiveOverlay"></div>' +
      '<div class="modal modal-massive" role="dialog" aria-modal="true" aria-labelledby="massiveTitle">' +
        '<div class="modal-head">' +
          '<h2 class="modal-title" id="massiveTitle">Ingresar seriales masivamente</h2>' +
          (canClose
            ? '<button class="modal-close" id="massiveClose" type="button" aria-label="Cerrar">' +
                '<img src="icon-close.svg" alt="">' +
              "</button>"
            : "") +
        "</div>" +
        massiveModalBody() +
      "</div>";

    var closeBtn = document.getElementById("massiveClose");
    var overlay = document.getElementById("massiveOverlay");
    if (closeBtn) closeBtn.addEventListener("click", closeMassiveModal);
    if (overlay && canClose) overlay.addEventListener("click", closeMassiveModal);

    var pickFile = document.getElementById("btnPickFile");
    if (pickFile) {
      pickFile.addEventListener("click", function () {
        els.fileInput.value = "";
        els.fileInput.click();
      });
    }

    var openCam = document.getElementById("btnOpenCamera");
    if (openCam) {
      openCam.addEventListener("click", showAndroidCamera);
    }
  }

  function handleImageSelected(file, sourceLabel) {
    if (!file) return;
    var max = 25 * 1024 * 1024;
    if (file.size > max) {
      state.message = {
        tone: "is-error",
        icon: "icon-error.svg",
        html: '<span class="message-emphasis">Archivo demasiado grande.</span> El máximo permitido es 25 MB.'
      };
      state.captureView = null;
      state.pendingFile = null;
      showMassiveModal();
      return;
    }
    state.pendingFile = file;
    state.message = null;
    startProcessing(sourceLabel);
  }

  function startProcessing(sourceLabel) {
    state.captureView = "processing";
    state.message = null;
    showMassiveModal();
    window.clearTimeout(processTimer);
    processTimer = window.setTimeout(function () {
      showToast("Modelo de identificación · procesando " + sourceLabel);
      applyMassiveSuccess(mockOcrSerials());
    }, 1400);
  }

  function serialPromptHtml() {
    var html = "";

    html += serialsCardHtml();

    html +=
      '<div class="serial-actions">' +
        '<button class="btn" type="button" id="btnMassive">Ingresar seriales masivamente</button>' +
      "</div>";

    html += promptField(
      "inputSerial",
      "",
      "Escanear o capturar serial",
      ""
    );

    return html;
  }

  function bindSerialPrompt() {
    var input = document.getElementById("inputSerial");
    var manualDisabled = state.massiveMode;

    if (input) {
      if (manualDisabled) {
        input.disabled = true;
        input.classList.add("is-disabled");
        input.placeholder = "Deshabilitado · modo masivo activo";
      } else {
        bindEnter("inputSerial", function (value) {
          if (!value) return;
          if (state.serials.indexOf(value) !== -1) {
            state.message = {
              tone: "is-error",
              icon: "icon-error.svg",
              html: '<span class="message-emphasis">Serial duplicado.</span> No se permite registrar un serial previamente ingresado.'
            };
            render();
            return;
          }
          if (state.serials.length >= state.cantidad) return;
          state.serials.push(value);
          state.message = null;
          if (state.serials.length >= state.cantidad) {
            finishSerials();
          } else {
            render();
          }
        });
      }
    }

    bindSerialsCard();

    var massiveBtn = document.getElementById("btnMassive");
    if (massiveBtn) {
      massiveBtn.addEventListener("click", function () {
        state.massiveMode = true;
        state.captureView = null;
        state.pendingFile = null;
        state.message = null;
        render();
        showMassiveModal();
      });
    }
  }

  function render() {
    els.stepList.innerHTML = state.rows.map(rowHtml).join("");
    els.messageZone.innerHTML = state.message ? messageBlock(state.message) : "";
    if (!(state.stage === "seriales" && state.massiveMode)) {
      clearModal();
    }
    els.footerZone.hidden = true;
    els.footerZone.innerHTML = "";

    var stage = state.stage;

    if (stage === "folio") {
      els.promptZone.innerHTML = promptField("inputFolio", "Folio", "Ingresar folio", state.folio);
      bindEnter("inputFolio", function (v) {
        if (!v) return;
        state.folio = v;
        confirmRow("Folio", v);
        state.stage = "lpn";
        state.message = null;
        render();
      });
      return;
    }

    if (stage === "lpn") {
      els.promptZone.innerHTML = promptField("inputLpn", "LPN", "Ingresar LPN", state.lpn);
      bindEnter("inputLpn", function (v) {
        if (!v) return;
        state.lpn = v;
        confirmRow("LPN", v);
        state.stage = "producto";
        render();
      });
      return;
    }

    if (stage === "producto") {
      els.promptZone.innerHTML = promptField(
        "inputProducto",
        "Producto",
        "SKU / código de barras",
        PRODUCT.sku
      );
      bindEnter("inputProducto", function (v) {
        if (!v) return;
        confirmRow("Producto", v);
        state.message = null;
        state.stage = "huella";
        render();
      });
      return;
    }

    if (stage === "huella") {
      els.promptZone.innerHTML = promptField("inputHuella", "Huella", "Seleccionar huella", PRODUCT.huella);
      bindEnter("inputHuella", function (v) {
        if (!v) return;
        confirmRow("Huella", v);
        state.stage = "cantidad";
        state.message = null;
        render();
      });
      return;
    }

    if (stage === "cantidad") {
      els.promptZone.innerHTML = promptField(
        "inputCantidad",
        "Cantidad",
        "Ingresar cantidad",
        String(state.cantidad)
      );
      bindEnter("inputCantidad", function (v) {
        var n = parseInt(v, 10);
        if (!n || n < 1) return;
        state.cantidad = n;
        confirmRow("Cantidad", String(n));
        state.stage = "estatus";
        render();
      });
      return;
    }

    if (stage === "estatus") {
      els.promptZone.innerHTML = promptField(
        "inputEstatus",
        "Estatus de inventario",
        "Ingresar estatus",
        PRODUCT.estatus
      );
      bindEnter("inputEstatus", function (v) {
        if (!v) return;
        confirmRow("Estatus de inventario", v);
        state.stage = "seriales";
        state.message = null;
        render();
      });
      return;
    }

    if (stage === "seriales") {
      els.promptZone.innerHTML = serialPromptHtml();
      bindSerialPrompt();
      if (state.massiveMode) {
        if (state.captureView === "camera") showAndroidCamera();
        else showMassiveModal();
      }
      return;
    }

    if (stage === "done") {
      els.promptZone.innerHTML =
        serialsCardHtml() +
        '<div class="action-stack">' +
          '<button class="btn btn-green" type="button" id="btnContinue">Continuar recibo</button>' +
          '<button class="btn btn-ghost" type="button" id="btnRestart">Nuevo recibo</button>' +
        "</div>";
      bindSerialsCard();
      document.getElementById("btnContinue").addEventListener("click", function () {
        showToast("<strong>Flujo de recibo</strong> · siguiente paso WEP", "success");
      });
      document.getElementById("btnRestart").addEventListener("click", reset);
    }
  }

  function reset() {
    window.clearTimeout(processTimer);
    state = defaults();
    els.toast.hidden = true;
    clearSystem();
    render();
  }

  els.fileInput.addEventListener("change", function () {
    handleImageSelected(els.fileInput.files && els.fileInput.files[0], "archivo");
  });

  reset();
})();
