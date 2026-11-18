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
      serialsOpen: false,
      massiveMode: false,
      captureView: null,
      pendingFile: null,
      message: null,
      serialsClosed: false
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

  function nextConsecutivo() {
    var max = 0;
    state.serials.forEach(function (entry) {
      if (entry.consecutivo > max) max = entry.consecutivo;
    });
    return max + 1;
  }

  function findSerialIndex(value) {
    for (var i = 0; i < state.serials.length; i++) {
      if (state.serials[i].value === value) return i;
    }
    return -1;
  }

  function addSerial(value, origin) {
    state.serials.push({
      consecutivo: nextConsecutivo(),
      value: value,
      origin: origin
    });
    state.serialsOpen = true;
  }

  function mockOcrSerials() {
    // Carga parcial para poder seguir ingresando o cancelar antes de completar
    var need = Math.min(2, remaining());
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
    clearSystem();
    clearModal();

    serials.forEach(function (s) {
      addSerial(s, "Masivo");
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
    state.stage = "localidad";
    state.massiveMode = false;
    state.captureView = null;
    state.serialsClosed = true;
    clearSystem();
    clearModal();
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

  function canEnterMoreSerials() {
    return !state.serialsClosed && !serialsComplete();
  }

  function cancelSerialsConfirm() {
    if (!state.serials.length) return;

    els.modalHost.innerHTML =
      '<div class="overlay" id="confirmOverlay"></div>' +
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancelTitle">' +
        '<div class="modal-head">' +
          '<h2 class="modal-title" id="cancelTitle">Cancelar ingreso de seriales</h2>' +
          '<button class="modal-close" id="cancelClose" type="button" aria-label="Cerrar">' +
            '<img src="icon-close.svg" alt="">' +
          "</button>" +
        "</div>" +
        '<p class="modal-copy">¿Estás seguro que deseas cancelar el ingreso de seriales?</p>' +
        '<div class="modal-actions confirm-actions">' +
          '<button class="btn btn-ghost" type="button" id="cancelNo">Regresar</button>' +
          '<button class="btn btn-danger" type="button" id="cancelYes">Cancelar ingreso</button>' +
        "</div>" +
      "</div>";

    function close() {
      clearModal();
    }

    document.getElementById("cancelClose").addEventListener("click", close);
    document.getElementById("confirmOverlay").addEventListener("click", close);
    document.getElementById("cancelNo").addEventListener("click", close);
    document.getElementById("cancelYes").addEventListener("click", function () {
      clearModal();
      state.serialsClosed = true;
      state.massiveMode = false;
      state.captureView = null;
      state.message = null;
      render();
      showToast(
        "<strong>Ingreso de seriales finalizado.</strong> La recepción queda con " +
          state.serials.length + " serial(es).",
        "success"
      );
    });
  }

  function serialsCardHtml() {
    var showCancel = state.serials.length > 0 && canEnterMoreSerials();
    var open = !!state.serialsOpen;
    var complete = serialsComplete();
    var statusLabel = complete || state.serialsClosed
      ? (complete ? "Completos" : "Cerrado")
      : state.serials.length
        ? "Pendientes"
        : "Sin seriales";
    var header = state.serials.length
      ? '<div class="serial-table-head" aria-hidden="true">' +
          '<span class="serial-col-cons"></span>' +
          '<span class="serial-col-serial">Serial</span>' +
          '<span class="serial-col-origin">Origen</span>' +
        "</div>"
      : "";
    var items = state.serials.length
      ? state.serials.map(function (entry) {
          return (
            '<li class="serial-item">' +
              '<span class="serial-col-cons">#' + entry.consecutivo + "</span>" +
              '<span class="serial-col-serial"><strong>' + entry.value + "</strong></span>" +
              '<span class="serial-col-origin">' +
                '<span class="serial-origin-chip is-' + (entry.origin === "Masivo" ? "masivo" : "manual") + '">' +
                  entry.origin +
                "</span>" +
              "</span>" +
            "</li>"
          );
        }).join("")
      : '<li class="serial-empty">Aún no hay seriales registrados.</li>';

    var cancelBar = showCancel
      ? '<div class="serials-select-bar">' +
          '<button class="btn btn-cancel-serials" type="button" id="btnCancelSerials">Cancelar ingreso de seriales</button>' +
        "</div>"
      : "";

    return (
      '<section class="serials-card' + (open ? " is-open" : "") + (complete || state.serialsClosed ? " is-complete" : "") +
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
          cancelBar +
          header +
          '<ul class="serial-list">' + items + "</ul>" +
        "</div>" +
      "</section>"
    );
  }

  function bindSerialsCard() {
    var toggleBtn = document.getElementById("btnToggleSerials");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        state.serialsOpen = !state.serialsOpen;
        render();
        if (state.stage === "seriales" && state.captureView === "processing") {
          showProcessingOverlay();
        } else if (state.stage === "seriales" && state.massiveMode) {
          if (state.captureView === "camera") showAndroidCamera();
          else showMassiveModal();
        }
      });
    }

    var cancelBtn = document.getElementById("btnCancelSerials");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        cancelSerialsConfirm();
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

  function showProcessingOverlay() {
    clearModal();
    els.systemHost.innerHTML =
      '<div class="processing-overlay" role="status" aria-live="polite" aria-label="Procesando imagen">' +
        '<div class="spinner is-lg" aria-hidden="true"></div>' +
      "</div>";
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
          '<p class="android-camera-hint">Encuadra la papeleta con los seriales</p>' +
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
    clearSystem();

    els.modalHost.innerHTML =
      '<div class="overlay" id="massiveOverlay"></div>' +
      '<div class="modal modal-massive" role="dialog" aria-modal="true" aria-labelledby="massiveTitle">' +
        '<div class="modal-head">' +
          '<h2 class="modal-title" id="massiveTitle">Ingresar seriales masivamente</h2>' +
          '<button class="modal-close" id="massiveClose" type="button" aria-label="Cerrar">' +
            '<img src="icon-close.svg" alt="">' +
          "</button>" +
        "</div>" +
        massiveModalBody() +
      "</div>";

    var closeBtn = document.getElementById("massiveClose");
    var overlay = document.getElementById("massiveOverlay");
    if (closeBtn) closeBtn.addEventListener("click", closeMassiveModal);
    if (overlay) overlay.addEventListener("click", closeMassiveModal);

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
    if (!canEnterMoreSerials() || !remaining()) {
      closeMassiveModal();
      return;
    }
    state.captureView = "processing";
    state.message = null;
    showProcessingOverlay();
    window.clearTimeout(processTimer);
    processTimer = window.setTimeout(function () {
      applyMassiveSuccess(mockOcrSerials());
    }, 1400);
  }

  function serialPromptHtml() {
    var html = "";
    var canEnter = canEnterMoreSerials();

    html += serialsCardHtml();

    if (canEnter) {
      html +=
        '<div class="serial-actions">' +
          '<button class="btn" type="button" id="btnMassive">Ingresar seriales masivamente</button>' +
        "</div>";

      if (!state.massiveMode) {
        html += promptField(
          "inputSerial",
          "",
          "Escanear o capturar serial",
          ""
        );
      }
    }

    return html;
  }

  function bindSerialPrompt() {
    var input = document.getElementById("inputSerial");
    var canEnter = canEnterMoreSerials();
    var manualDisabled = state.massiveMode || !canEnter;

    if (input) {
      if (manualDisabled) {
        input.disabled = true;
        input.classList.add("is-disabled");
        input.placeholder = state.massiveMode
          ? "Deshabilitado · modo masivo activo"
          : "Cantidad de seriales completada";
      } else {
        bindEnter("inputSerial", function (value) {
          if (!value || !canEnterMoreSerials()) return;
          if (findSerialIndex(value) !== -1) {
            state.message = {
              tone: "is-error",
              icon: "icon-error.svg",
              html: '<span class="message-emphasis">Serial duplicado.</span> No se permite registrar un serial previamente ingresado.'
            };
            render();
            return;
          }
          if (state.serials.length >= state.cantidad) return;
          addSerial(value, "Manual");
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
        if (!canEnterMoreSerials()) return;
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
      if (state.captureView === "processing") {
        showProcessingOverlay();
      } else if (state.massiveMode) {
        if (state.captureView === "camera") showAndroidCamera();
        else showMassiveModal();
      }
      return;
    }

    if (stage === "localidad") {
      els.promptZone.innerHTML =
        serialsCardHtml() +
        promptField(
          "inputLocalidad",
          "Localidad destino",
          "Ingresar localidad destino",
          ""
        );
      bindSerialsCard();
      bindEnter("inputLocalidad", function (v) {
        if (!v) return;
        confirmRow("Localidad destino", v);
        state.stage = "done";
        state.message = null;
        render();
        showToast("<strong>Recibo</strong> · localidad registrada", "success");
      });
      return;
    }

    if (stage === "done") {
      els.promptZone.innerHTML = serialsCardHtml();
      bindSerialsCard();
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
