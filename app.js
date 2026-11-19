(function () {
  "use strict";

  var DATA = window.CFOP_DATA;
  var allItems = DATA.oll.concat(DATA.pll);
  var learnAdjacentPairs = [["OLL32","OLL31"],["OLL43","OLL44"],["PLLGa","PLLGc"],["PLLGb","PLLGd"]];
  var selectedFamily = "all";
  var selectedGroup = "all";
  var currentView = "learn";
  var lastStudyView = "learn";
  var formulasVisible = true;
  var quizKind = "formula";
  var questionCount = 20;
  var session = null;
  var mastered = readStore("cubeRecallMasteredV2", null);
  if (!Array.isArray(mastered)) {
    var oldMastered = readStore("cubeRecallMastered", []);
    mastered = (Array.isArray(oldMastered) ? oldMastered : []).map(function (id) {
      var oldCase = DATA.oll.find(function (item) { return item.sourceKey === id; });
      return oldCase ? oldCase.id : id;
    });
    writeStore("cubeRecallMasteredV2", mastered);
  }
  var bestRecord = readStore("cubeRecallBest", null);
  var flashDeck = [];
  var flashIndex = 0;
  var flashFlipped = false;
  var flashGroup = "all";
  var timerTimes = readStore("cubeRecallTimerTimesV1", []);
  if (!Array.isArray(timerTimes)) timerTimes = [];
  timerTimes = timerTimes.filter(function (time) { return typeof time === "number" && isFinite(time) && time >= 0; });
  var savedScrambles = readStore("cubeRecallSavedScramblesV1", []);
  if (!Array.isArray(savedScrambles)) savedScrambles = [];
  savedScrambles = savedScrambles.filter(function (scramble) { return typeof scramble === "string" && scramble.trim(); });
  var timerRunning = false;
  var timerStartStamp = 0;
  var timerFrame = null;
  var timerKeyHeld = false;
  var timerArmed = false;
  var timerArmTimeout = null;
  var scrambleMoves = [];

  var learnView = document.getElementById("learnView");
  var flashcardView = document.getElementById("flashcardView");
  var learningWorkspace = document.getElementById("learningWorkspace");
  var timerView = document.getElementById("timerView");
  var quizView = document.getElementById("quizView");
  var learnGrid = document.getElementById("learnGrid");
  var groupFilters = document.getElementById("groupFilters");
  var quizSetup = document.getElementById("quizSetup");
  var quizRun = document.getElementById("quizRun");
  var quizSummary = document.getElementById("quizSummary");

  function readStore(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function getFamilyItems() {
    return selectedFamily === "all" ? allItems.slice() : allItems.filter(function (item) {
      return item.family === selectedFamily;
    });
  }

  var FACE_COLORS = {U:"#f8f7ef", L:"#e79b5c", F:"#65a77b", R:"#d96d5e", B:"#5c85bd", D:"#efd04e"};
  var FACE_NORMALS = {U:[0,1,0], D:[0,-1,0], F:[0,0,1], B:[0,0,-1], R:[1,0,0], L:[-1,0,0]};
  var FACE_AXES = {U:[1,1], D:[1,-1], F:[2,1], B:[2,-1], R:[0,1], L:[0,-1]};

  function formatTimer(milliseconds) {
    var totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10));
    var totalSeconds = Math.floor(totalCentiseconds / 100);
    var centiseconds = String(totalCentiseconds % 100).padStart(2, "0");
    var seconds = totalSeconds % 60;
    if (totalSeconds >= 60) return Math.floor(totalSeconds / 60) + ":" + String(seconds).padStart(2, "0") + "." + centiseconds;
    return totalSeconds + "." + centiseconds;
  }

  function renderTimerStats() {
    var last = timerTimes.length ? timerTimes[0] : null;
    var best = timerTimes.length ? Math.min.apply(Math, timerTimes) : null;
    var ao5 = null;
    if (timerTimes.length >= 5) {
      var recentFive = timerTimes.slice(0, 5).slice().sort(function (a, b) { return a - b; });
      ao5 = (recentFive[1] + recentFive[2] + recentFive[3]) / 3;
    }
    document.getElementById("lastTime").textContent = last === null ? "—" : formatTimer(last);
    document.getElementById("bestTime").textContent = best === null ? "—" : formatTimer(best);
    document.getElementById("ao5Time").textContent = ao5 === null ? "—" : formatTimer(ao5);
    document.getElementById("timerSolveCount").textContent = timerTimes.length + " lần giải";
    document.getElementById("timerHistory").innerHTML = timerTimes.length ? timerTimes.slice(0, 5).map(function (time, index) {
      return '<li><span>#' + (timerTimes.length - index) + '</span><b>' + formatTimer(time) + '</b></li>';
    }).join("") : '<li class="timer-history-empty">Chưa có thời gian nào được lưu.</li>';
    document.getElementById("clearTimerHistory").disabled = timerTimes.length === 0;
  }

  function renderSavedScrambles() {
    var list = document.getElementById("savedScrambleList");
    document.getElementById("savedScrambleCount").textContent = savedScrambles.length;
    if (!savedScrambles.length) {
      list.innerHTML = '<p class="saved-scramble-empty">Chưa có scramble nào được lưu.</p>';
      return;
    }
    list.innerHTML = savedScrambles.map(function (scramble, index) {
      return '<div class="saved-scramble-item"><span class="saved-scramble-text">' + escapeHTML(scramble) + '</span><span class="saved-scramble-actions"><button class="button button-quiet button-small" type="button" data-load-scramble="' + index + '">Dùng</button><button class="button button-quiet button-small" type="button" data-delete-scramble="' + index + '" aria-label="Xóa scramble đã lưu">×</button></span></div>';
    }).join("");
  }

  function displayScramble() {
    document.getElementById("scrambleSequence").textContent = scrambleMoves.join(" ");
    renderCubeImage();
  }

  function createScramble() {
    var faces = ["U","D","L","R","F","B"];
    var axisByFace = {U:1,D:1,L:0,R:0,F:2,B:2};
    var suffixes = ["", "'", "2"];
    var moves = [];
    while (moves.length < 20) {
      var face = faces[Math.floor(Math.random() * faces.length)];
      var previousFace = moves.length ? moves[moves.length - 1].charAt(0) : "";
      if (face === previousFace || (previousFace && axisByFace[face] === axisByFace[previousFace])) continue;
      moves.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
    }
    return moves;
  }

  function faceletPosition(face, row, column) {
    if (face === "U") return [column - 1, 1, row - 1];
    if (face === "D") return [column - 1, -1, 1 - row];
    if (face === "F") return [column - 1, 1 - row, 1];
    if (face === "B") return [1 - column, 1 - row, -1];
    if (face === "R") return [1, 1 - row, 1 - column];
    return [-1, 1 - row, column - 1];
  }

  function createSolvedStickers() {
    var stickers = [];
    ["U","L","F","R","B","D"].forEach(function (face) {
      for (var row = 0; row < 3; row += 1) {
        for (var column = 0; column < 3; column += 1) {
          stickers.push({position:faceletPosition(face, row, column), normal:FACE_NORMALS[face].slice(), color:FACE_COLORS[face]});
        }
      }
    });
    return stickers;
  }

  function rotateVector(vector, axis, direction) {
    var x = vector[0], y = vector[1], z = vector[2];
    if (axis === 0) return direction > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === 1) return direction > 0 ? [z, y, -x] : [-z, y, x];
    return direction > 0 ? [-y, x, z] : [y, -x, z];
  }

  function applyScrambleMove(stickers, move) {
    var parsed = move.match(/^([URFDLBMESxyzurfdlb])(w)?(2)?(')?$/);
    if (!parsed) return;
    var notation = parsed[1];
    var face = notation.toUpperCase();
    var axis, layer, direction, isWide = !!parsed[2] || notation !== notation.toUpperCase();
    var sliceOnly = false, wholeCube = false;

    if (face === "M" || face === "E" || face === "S") {
      axis = face === "M" ? 0 : (face === "E" ? 1 : 2);
      direction = face === "S" ? -1 : 1;
      sliceOnly = true;
    } else if (notation === "x" || notation === "y" || notation === "z") {
      axis = notation === "x" ? 0 : (notation === "y" ? 1 : 2);
      direction = -1;
      wholeCube = true;
    } else {
      var axisAndLayer = FACE_AXES[face];
      if (!axisAndLayer) return;
      axis = axisAndLayer[0];
      layer = axisAndLayer[1];
      direction = -layer;
    }
    if (parsed[4]) direction *= -1;
    var turns = parsed[3] ? 2 : 1;
    for (var turn = 0; turn < turns; turn += 1) {
      stickers.forEach(function (sticker) {
        var coordinate = sticker.position[axis];
        var selected = wholeCube || (sliceOnly ? coordinate === 0 : (coordinate === layer || (isWide && coordinate === 0)));
        if (selected) {
          sticker.position = rotateVector(sticker.position, axis, direction);
          sticker.normal = rotateVector(sticker.normal, axis, direction);
        }
      });
    }
  }

  function faceletIndex(face, position) {
    var row, column;
    if (face === "U") { row = position[2] + 1; column = position[0] + 1; }
    else if (face === "D") { row = 1 - position[2]; column = position[0] + 1; }
    else if (face === "F") { row = 1 - position[1]; column = position[0] + 1; }
    else if (face === "B") { row = 1 - position[1]; column = 1 - position[0]; }
    else if (face === "R") { row = 1 - position[1]; column = 1 - position[2]; }
    else { row = 1 - position[1]; column = position[2] + 1; }
    return row * 3 + column;
  }

  function getScrambledFace(stickers, face) {
    var colors = new Array(9);
    var normal = FACE_NORMALS[face];
    stickers.forEach(function (sticker) {
      if (sticker.normal[0] === normal[0] && sticker.normal[1] === normal[1] && sticker.normal[2] === normal[2]) {
        colors[faceletIndex(face, sticker.position)] = sticker.color;
      }
    });
    return colors;
  }

  function createCubeNetMarkup(moves) {
    var stickers = createSolvedStickers();
    moves.forEach(function (move) { applyScrambleMove(stickers, move); });
    return ["U","L","F","R","B","D"].map(function (face) {
      return '<div class="net-face" data-face="' + face + '" aria-label="Mặt ' + face + '">' + getScrambledFace(stickers, face).map(function (color) {
        return '<span class="net-sticker" style="--sticker-color:' + color + '"></span>';
      }).join("") + '</div>';
    }).join("");
  }

  function renderCubeImage() {
    var cubeNet = document.getElementById("cubeNet");
    cubeNet.innerHTML = createCubeNetMarkup(scrambleMoves);
    cubeNet.setAttribute("aria-label", "Hình lưới 2D của scramble " + scrambleMoves.join(" "));
  }

  function newScramble() {
    if (timerRunning) return;
    scrambleMoves = createScramble();
    displayScramble();
  }

  function saveCurrentScramble(button) {
    if (!scrambleMoves.length) return;
    var scramble = scrambleMoves.join(" ");
    if (savedScrambles.indexOf(scramble) === -1) {
      savedScrambles.unshift(scramble);
      savedScrambles = savedScrambles.slice(0, 100);
      writeStore("cubeRecallSavedScramblesV1", savedScrambles);
      renderSavedScrambles();
    }
    var originalText = button.innerHTML;
    button.innerHTML = 'Đã lưu ✓';
    window.setTimeout(function () { if (document.body.contains(button)) button.innerHTML = originalText; }, 1200);
  }

  function clearTimerHistory() {
    if (!timerTimes.length || !window.confirm("Xóa toàn bộ lịch sử thời gian giải?")) return;
    timerTimes = [];
    writeStore("cubeRecallTimerTimesV1", timerTimes);
    document.getElementById("timerReadout").textContent = "0.00";
    document.getElementById("timerStatus").textContent = "Đã xóa lịch sử thời gian giải.";
    renderTimerStats();
  }

  function updateTimerMode() {
    var panel = document.getElementById("timerPanel");
    panel.classList.toggle("is-running", timerRunning);
    panel.classList.toggle("is-ready", timerKeyHeld && timerArmed && !timerRunning);
    document.getElementById("newScramble").disabled = timerRunning;
    var button = document.getElementById("timerStart");
    button.innerHTML = timerRunning ? 'Dừng và lưu <span aria-hidden="true">■</span>' : 'Bắt đầu giải <span aria-hidden="true">↗</span>';
    button.setAttribute("aria-label", timerRunning ? "Dừng và lưu thời gian" : "Bắt đầu giải bấm giờ");
  }

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerStartStamp = performance.now();
    document.getElementById("timerStatus").textContent = "Đang giải · nhấn Space hoặc bấm nút để dừng.";
    updateTimerMode();
    tickTimer();
  }

  function tickTimer() {
    if (!timerRunning) return;
    document.getElementById("timerReadout").textContent = formatTimer(performance.now() - timerStartStamp);
    timerFrame = window.requestAnimationFrame(tickTimer);
  }

  function stopTimer() {
    if (!timerRunning) return;
    var elapsed = Math.round((performance.now() - timerStartStamp) / 10) * 10;
    timerRunning = false;
    if (timerFrame) window.cancelAnimationFrame(timerFrame);
    timerFrame = null;
    timerTimes.unshift(elapsed);
    timerTimes = timerTimes.slice(0, 500);
    writeStore("cubeRecallTimerTimesV1", timerTimes);
    document.getElementById("timerReadout").textContent = formatTimer(elapsed);
    document.getElementById("timerStatus").textContent = "Đã lưu thời gian · scramble hiện tại vẫn được giữ.";
    updateTimerMode();
    renderTimerStats();
  }

  function cancelTimerArm() {
    timerKeyHeld = false;
    timerArmed = false;
    if (timerArmTimeout) window.clearTimeout(timerArmTimeout);
    timerArmTimeout = null;
    updateTimerMode();
  }

  function updatePersonalStats() {
    var count = mastered.filter(function (id) {
      return allItems.some(function (item) { return item.id === id; });
    }).length;
    document.getElementById("masteredCount").textContent = count + " / 78";
    document.getElementById("bestScore").textContent = bestRecord ? bestRecord.percent + "%" : "—";
  }

  function renderGroupFilters() {
    var groups = [];
    getFamilyItems().forEach(function (item) {
      if (groups.indexOf(item.group) === -1) groups.push(item.group);
    });
    var html = '<button class="group-chip' + (selectedGroup === "all" ? " active" : "") + '" type="button" data-group="all">Tất cả nhóm</button>';
    groups.forEach(function (group) {
      html += '<button class="group-chip' + (selectedGroup === group ? " active" : "") + '" type="button" data-group="' + escapeHTML(group) + '">' + escapeHTML(group) + '</button>';
    });
    groupFilters.innerHTML = html;
  }

  function renderFlashGroupSelect() {
    var select = document.getElementById("flashGroupSelect");
    var groups = [];
    getFamilyItems().forEach(function (item) {
      if (groups.indexOf(item.group) === -1) groups.push(item.group);
    });
    if (flashGroup !== "all" && groups.indexOf(flashGroup) === -1) flashGroup = "all";
    select.innerHTML = '<option value="all">Tất cả nhóm</option>' + groups.map(function (group) {
      return '<option value="' + escapeHTML(group) + '">' + escapeHTML(group) + '</option>';
    }).join("");
    select.value = flashGroup;
  }

  function rebuildFlashDeck(shouldShuffle) {
    flashDeck = getFamilyItems().filter(function (item) {
      return flashGroup === "all" || item.group === flashGroup;
    });
    if (shouldShuffle) flashDeck = shuffle(flashDeck);
    flashIndex = 0;
    flashFlipped = false;
    renderFlashcard();
  }

  function renderFlashcard() {
    if (!flashDeck.length) return;
    var item = flashDeck[flashIndex];
    var card = document.getElementById("flashCard");
    var image = document.getElementById("flashImage");
    var fallback = document.querySelector(".flash-image-fallback");
    image.style.display = "";
    fallback.classList.add("hidden");
    image.alt = "Hình minh họa " + item.label;
    image.onerror = function () {
      image.style.display = "none";
      fallback.classList.remove("hidden");
    };
    image.src = getCaseImage(item);
    image.style.transform = imageTransform(item);
    document.getElementById("flashFrontFamily").textContent = item.family;
    document.getElementById("flashBackFamily").textContent = item.family;
    document.getElementById("flashBackLabel").textContent = item.label;
    document.getElementById("flashBackGroup").textContent = item.group;
    document.getElementById("flashFormula").textContent = getPrimaryFormula(item);
    var formulaOrigin = document.getElementById("flashFormulaOrigin");
    var primaryMirror = getPrimaryMirrorConfig(item);
    formulaOrigin.classList.toggle("hidden", !primaryMirror);
    formulaOrigin.textContent = primaryMirror ? "Mirror từ " + findItem(primaryMirror.from).label : "";
    document.getElementById("flashPosition").textContent = String(flashIndex + 1).padStart(2, "0") + " / " + String(flashDeck.length).padStart(2, "0");
    document.getElementById("flashRemaining").textContent = flashDeck.length + " thẻ";
    document.getElementById("flashProgress").style.width = ((flashIndex + 1) / flashDeck.length * 100) + "%";
    document.getElementById("flashInner").classList.toggle("flipped", flashFlipped);
    card.setAttribute("aria-pressed", flashFlipped ? "true" : "false");
    card.setAttribute("aria-label", flashFlipped ? "Đang xem công thức; lật lại để xem hình" : "Lật thẻ để xem công thức");
    document.getElementById("flashReveal").innerHTML = (flashFlipped ? "Xem hình " : "Lật thẻ ") + '<span aria-hidden="true">↻</span>';
    var markButton = document.getElementById("flashMarkMastered");
    var isMastered = mastered.indexOf(item.id) !== -1;
    markButton.classList.toggle("mastered-active", isMastered);
    markButton.textContent = isMastered ? "✓ Đã thuộc" : "+ Đã thuộc";
  }

  function flipFlashcard() {
    flashFlipped = !flashFlipped;
    renderFlashcard();
  }

  function moveFlashcard(direction) {
    if (!flashDeck.length) return;
    flashIndex = (flashIndex + direction + flashDeck.length) % flashDeck.length;
    flashFlipped = false;
    renderFlashcard();
  }

  function getMirrorItem(family, code) {
    var collection = family === "OLL" ? DATA.oll : DATA.pll;
    var label = family === "OLL" ? "OLL " + code : "PLL " + code;
    return collection.find(function (item) { return item.label === label; });
  }

  function mirrorAlgorithm(algorithm) {
    var swappedFaces = {R:"L", L:"R", r:"l", l:"r"};
    return algorithm.replace(/([RLUDFBrludfbMESxyz])([w]?)(2)?(')?/g, function (token, face, wide, half, prime) {
      var mirroredFace = swappedFaces[face] || face;
      var reversesTurn = face !== "x" && face !== "M";
      var outputPrime = half ? "" : ((!!prime !== reversesTurn) ? "'" : "");
      return mirroredFace + (wide || "") + (half || "") + outputPrime;
    });
  }

  function invertAlgorithm(algorithm) {
    var moves = algorithm.match(/[URFDLBMESxyzurfdlb](?:w)?(?:2)?'?/g) || [];
    return moves.reverse().map(function (move) {
      if (move.indexOf("2") !== -1) return move.replace("'", "");
      return move.slice(-1) === "'" ? move.slice(0, -1) : move + "'";
    }).join(" ");
  }

  function getPrimaryMirrorConfig(item) {
    return (DATA.primaryMirrorCases || {})[item.id] || null;
  }

  function getPrimaryFormula(item) {
    var config = getPrimaryMirrorConfig(item);
    var source = config ? findItem(config.from) : null;
    return source ? mirrorAlgorithm(source.formula) : item.formula;
  }

  function imageTransform(item) {
    var config = getPrimaryMirrorConfig(item);
    if (!config) return "";
    var transforms = [];
    if (config.imageFlipX) transforms.push("scaleX(-1)");
    if (config.imageRotation) transforms.push("rotate(" + config.imageRotation + "deg)");
    return transforms.join(" ");
  }

  function getCaseImage(item) {
    var config = getPrimaryMirrorConfig(item);
    var source = config && config.imageFrom ? findItem(config.imageFrom) : null;
    return source ? source.image : item.image;
  }

  function getMirrorPartners(item) {
    var code = item.label.slice(4);
    var partners = [];
    (DATA.mirrorPairs[item.family] || []).forEach(function (pair) {
      var partnerCode = pair[0] === code ? pair[1] : (pair[1] === code ? pair[0] : null);
      var partner = partnerCode ? getMirrorItem(item.family, partnerCode) : null;
      if (partner && partners.indexOf(partner) === -1) partners.push(partner);
    });
    return partners;
  }

  function renderInlineMirrors(item) {
    var partners = getMirrorPartners(item);
    if (!partners.length) return "";
    return '<div class="mirror-inline-list" aria-label="Các trường hợp mirror của ' + escapeHTML(item.label) + '">' +
      partners.map(function (partner) {
        var formulaClass = "mirror-inline-formula" + (formulasVisible ? "" : " is-hidden");
        var referenceClass = formulasVisible ? "" : " class=\"is-hidden\"";
        return '<div class="mirror-inline">' +
          '<div class="mirror-inline-image"><img loading="lazy" src="' + escapeHTML(getCaseImage(partner)) + '" alt="Hình minh họa ' + escapeHTML(partner.label) + '" style="transform:' + imageTransform(partner) + '"></div>' +
          '<div class="mirror-inline-content"><div class="mirror-inline-meta"><b class="mirror-inline-label">' + escapeHTML(partner.label) + '</b><span>↔ MIRROR</span></div>' +
          '<code class="' + formulaClass + '">' + escapeHTML(mirrorAlgorithm(getPrimaryFormula(item))) + '</code>' +
          '<div class="mirror-inline-actions"><button class="mirror-copy" type="button" data-copy-mirror="' + escapeHTML(item.id) + '">Sao chép mirror</button>' +
          '<details class="mirror-inline-reference"><summary>Công thức gợi ý</summary><code' + referenceClass + '>' + escapeHTML(getPrimaryFormula(partner)) + '</code></details></div></div>' +
        '</div>';
      }).join("") + '</div>';
  }

  function getVisibleItems() {
    var query = document.getElementById("searchInput").value.trim().toLocaleLowerCase("vi");
    return getFamilyItems().filter(function (item) {
      var matchesGroup = selectedGroup === "all" || item.group === selectedGroup;
      var haystack = (item.label + " " + item.group + " " + getPrimaryFormula(item)).toLocaleLowerCase("vi");
      return matchesGroup && (!query || haystack.indexOf(query) !== -1);
    });
  }

  function renderLearn() {
    var items = getVisibleItems();
    document.getElementById("resultsCount").textContent = items.length + (items.length === 1 ? " trường hợp" : " trường hợp");
    document.getElementById("emptyState").classList.toggle("hidden", items.length > 0);
    learnGrid.classList.toggle("hidden", items.length === 0);
    var itemsById = {};
    var rendered = {};
    items.forEach(function (item) { itemsById[item.id] = item; });
    learnGrid.innerHTML = items.map(function (item) {
      if (rendered[item.id]) return "";
      var pair = learnAdjacentPairs.find(function (candidate) { return candidate.indexOf(item.id) !== -1; });
      if (pair && itemsById[pair[0]] && itemsById[pair[1]]) {
        rendered[pair[0]] = true;
        rendered[pair[1]] = true;
        return '<div class="case-pair-group" role="group" aria-label="Cặp mirror ' + escapeHTML(pair[0].replace("OLL", "OLL ").replace("PLL", "PLL ")) + ' và ' + escapeHTML(pair[1].replace("OLL", "OLL ").replace("PLL", "PLL ")) + '">' +
          renderCaseCard(itemsById[pair[0]]) + renderCaseCard(itemsById[pair[1]]) + '</div>';
      }
      rendered[item.id] = true;
      return renderCaseCard(item);
    }).join("");
    bindImageFallbacks(learnGrid);
    document.getElementById("toggleFormulas").innerHTML = (formulasVisible ? "Ẩn công thức " : "Hiện công thức ") + '<span aria-hidden="true">' + (formulasVisible ? "◉" : "◎") + '</span>';
  }

  function renderCaseCard(item) {
    var isMastered = mastered.indexOf(item.id) !== -1;
    var formulaClass = formulasVisible ? "formula" : "formula is-hidden";
    var primaryMirror = getPrimaryMirrorConfig(item);
    var mirrorNote = primaryMirror ? '<div class="formula-origin">MIRROR TỪ ' + escapeHTML(findItem(primaryMirror.from).label) + ' · CÔNG THỨC CHÍNH</div>' : "";
    return '<article class="case-card" data-case="' + escapeHTML(item.id) + '">' +
      '<div class="case-image"><img loading="lazy" src="' + escapeHTML(getCaseImage(item)) + '" alt="Hình minh họa ' + escapeHTML(item.label) + '" style="transform:' + imageTransform(item) + '"><span class="image-type">' + escapeHTML(item.family) + '</span></div>' +
      '<div class="case-body"><div class="case-meta"><span class="case-name">' + escapeHTML(item.label) + '</span><span class="group-label">' + escapeHTML(item.group) + '</span></div>' +
      mirrorNote + '<div class="' + formulaClass + '" data-formula="' + escapeHTML(item.id) + '">' + escapeHTML(getPrimaryFormula(item)) + '</div>' +
      renderInlineMirrors(item) +
      '<div class="card-actions"><button class="card-link copy-button" type="button" data-copy="' + escapeHTML(item.id) + '">Sao chép công thức ↗</button>' +
      '<button class="master-button' + (isMastered ? " done" : "") + '" type="button" data-master="' + escapeHTML(item.id) + '">' + (isMastered ? "✓ Đã thuộc" : "+ Đã thuộc") + '</button></div>' +
      '<button class="case-setup-trigger" type="button" data-case-setup="' + escapeHTML(item.id) + '"><span aria-hidden="true">↶</span> Tạo case từ khối đã giải</button></div></article>';
  }

  function showCaseSetup(item, trigger) {
    var currentPanel = trigger.closest(".case-body").querySelector(".case-setup-panel");
    if (currentPanel) {
      currentPanel.remove();
      trigger.classList.remove("active");
      trigger.innerHTML = '<span aria-hidden="true">↶</span> Tạo case từ khối đã giải';
      return;
    }
    learnGrid.querySelectorAll(".case-setup-panel").forEach(function (panel) { panel.remove(); });
    learnGrid.querySelectorAll("[data-case-setup]").forEach(function (button) {
      button.classList.remove("active");
      button.innerHTML = '<span aria-hidden="true">↶</span> Tạo case từ khối đã giải';
    });

    var setupMoves = invertAlgorithm(getPrimaryFormula(item));
    var panel = document.createElement("div");
    panel.className = "case-setup-panel";
    panel.innerHTML = '<div class="case-setup-heading"><span>SETUP TỪ KHỐI ĐÃ GIẢI</span><b>' + escapeHTML(item.label) + '</b></div>' +
      '<p class="case-setup-note">Bắt đầu với mặt vàng hướng lên và mặt trước hướng về phía bạn. Làm đủ chuỗi setup; x/y/z là xoay cả khối.</p>' +
      '<code class="case-setup-sequence">' + escapeHTML(setupMoves) + '</code>' +
      '<button class="case-setup-copy" type="button" data-copy-case-setup="' + escapeHTML(item.id) + '">Sao chép chuỗi setup ↗</button>' +
      '<div class="case-setup-net-wrap"><div class="cube-net case-setup-net" role="img" aria-label="Hình trạng thái khối sau chuỗi setup"></div><small>Trạng thái khối sau khi làm chuỗi setup</small></div>';
    trigger.closest(".case-body").appendChild(panel);
    panel.querySelector(".case-setup-net").innerHTML = createCubeNetMarkup(setupMoves.split(/\s+/));
    trigger.classList.add("active");
    trigger.innerHTML = '<span aria-hidden="true">×</span> Ẩn chuỗi setup';
  }

  function bindImageFallbacks(root) {
    root.querySelectorAll("img").forEach(function (image) {
      image.addEventListener("error", function () {
        var parent = image.parentElement;
        if (!parent || parent.querySelector(".image-fallback")) return;
        image.remove();
        var label = parent.closest(".case-card");
        var mirror = parent.closest(".mirror-inline");
        var review = parent.closest(".review-item");
        var reviewName = review ? review.querySelector("strong").textContent.split(" · ")[0] : "Rubik";
        var caseName = mirror ? mirror.querySelector(".mirror-inline-label").textContent : (label ? label.querySelector(".case-name").textContent : (review ? reviewName : (image.alt || "Rubik")));
        var fallback = document.createElement("div");
        fallback.className = "image-fallback";
        fallback.innerHTML = '<span class="fallback-cube" aria-hidden="true">▦</span><b>' + escapeHTML(caseName) + '</b><small>Hình cần kết nối internet</small>';
        parent.insertBefore(fallback, parent.firstChild);
      }, {once:true});
    });
  }

  function setFamily(family) {
    selectedFamily = family;
    selectedGroup = "all";
    document.querySelectorAll(".family-tab").forEach(function (tab) {
      var active = tab.dataset.family === family;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderGroupFilters();
    renderLearn();
    renderFlashGroupSelect();
    rebuildFlashDeck(false);
    if (session) showQuizSetup();
  }

  function setView(view) {
    if (currentView === "timer") cancelTimerArm();
    currentView = view;
    lastStudyView = view;
    document.querySelectorAll(".view-tab").forEach(function (tab) {
      var active = tab.dataset.view === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    learnView.classList.toggle("hidden", view !== "learn");
    flashcardView.classList.toggle("hidden", view !== "flashcards");
    quizView.classList.toggle("hidden", view !== "quiz");
    if (view === "quiz" && session) showQuizSetup();
  }

  function setMainMode(mode) {
    var timerMode = mode === "timer";
    document.querySelectorAll(".main-mode-tab").forEach(function (tab) {
      var active = tab.dataset.mainMode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    learningWorkspace.classList.toggle("hidden", timerMode);
    timerView.classList.toggle("hidden", !timerMode);
    if (timerMode) {
      currentView = "timer";
    } else {
      if (currentView === "timer") cancelTimerArm();
      setView(lastStudyView);
    }
  }

  function showQuizSetup() {
    session = null;
    quizSetup.classList.remove("hidden");
    quizRun.classList.add("hidden");
    quizSummary.classList.add("hidden");
  }

  function findItem(id) {
    return allItems.find(function (item) { return item.id === id; });
  }

  function toggleMastered(id) {
    if (mastered.indexOf(id) === -1) mastered.push(id);
    else mastered = mastered.filter(function (itemId) { return itemId !== id; });
    writeStore("cubeRecallMasteredV2", mastered);
    updatePersonalStats();
    renderLearn();
    renderFlashcard();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch (error) {}
    area.remove();
  }

  function startQuiz() {
    var pool = getFamilyItems();
    var amount = questionCount === "all" ? pool.length : Math.min(Number(questionCount), pool.length);
    var questions = shuffle(pool).slice(0, amount);
    session = {questions: questions, index: 0, correct: 0, results: [], answered: false, options: []};
    quizSetup.classList.add("hidden");
    quizSummary.classList.add("hidden");
    quizRun.classList.remove("hidden");
    renderQuestion();
  }

  function buildOptions(question) {
    var candidates;
    if (quizKind === "formula") {
      candidates = allItems.filter(function (item) {
        return item.family === question.family && item.id !== question.id && getPrimaryFormula(item) !== getPrimaryFormula(question);
      });
    } else {
      candidates = allItems.filter(function (item) {
        return item.family === question.family && item.id !== question.id;
      });
    }
    var distractors = [];
    shuffle(candidates).some(function (candidate) {
      var display = quizKind === "formula" ? getPrimaryFormula(candidate) : candidate.label;
      var repeated = distractors.some(function (picked) { return picked.display === display; });
      if (!repeated) distractors.push({display: display, item: candidate});
      return distractors.length === 3;
    });
    var correctDisplay = quizKind === "formula" ? getPrimaryFormula(question) : question.label;
    var options = distractors.concat([{display: correctDisplay, item: question, correct: true}]);
    options.forEach(function (option) { option.correct = option.item.id === question.id; });
    return shuffle(options);
  }

  function renderQuestion() {
    if (!session) return;
    var question = session.questions[session.index];
    session.answered = false;
    session.options = buildOptions(question);
    document.getElementById("questionPosition").textContent = "Câu " + (session.index + 1) + " / " + session.questions.length;
    document.getElementById("liveScore").textContent = session.correct;
    document.getElementById("progressFill").style.width = (session.index / session.questions.length * 100) + "%";
    document.getElementById("questionFamily").textContent = question.family;
    document.getElementById("questionGroup").textContent = question.group;
    document.getElementById("questionPrompt").textContent = quizKind === "formula" ? "Công thức nào giải đúng trường hợp này?" : "Đây là trường hợp nào?";
    var image = document.getElementById("questionImage");
    var imageWrap = image.parentElement;
    var oldFallback = imageWrap.querySelector(".quiz-image-fallback");
    if (oldFallback) oldFallback.remove();
    image.style.display = "";
    image.src = getCaseImage(question);
    image.style.transform = imageTransform(question);
    image.alt = "Hình minh họa trường hợp " + question.label;
    image.classList.remove("image-failed");
    image.onerror = function () {
      image.style.display = "none";
      image.alt = "Không tải được hình minh họa " + question.label + ". Hãy kiểm tra kết nối internet.";
      var fallback = document.createElement("div");
      fallback.className = "quiz-image-fallback";
      fallback.innerHTML = '<span aria-hidden="true">▦</span><b>' + escapeHTML(question.label) + '</b><small>Hình cần kết nối internet</small>';
      imageWrap.insertBefore(fallback, imageWrap.firstChild);
    };
    document.getElementById("answerFeedback").className = "answer-feedback hidden";
    document.getElementById("answerFeedback").textContent = "";
    document.getElementById("nextQuestion").classList.add("hidden");
    document.getElementById("answerStatus").textContent = "Chọn đáp án bạn cho là đúng.";
    document.getElementById("progressFill").style.width = (session.index / session.questions.length * 100) + "%";
    document.getElementById("answerGrid").innerHTML = session.options.map(function (option, index) {
      var display = option.display;
      return '<button class="answer-option' + (quizKind === "name" ? " kind-name" : "") + '" type="button" data-option="' + index + '">' +
        '<span class="answer-key">' + (index + 1) + '</span><span class="answer-text">' + escapeHTML(display) + '</span></button>';
    }).join("");
  }

  function selectAnswer(index) {
    if (!session || session.answered) return;
    var question = session.questions[session.index];
    var selected = session.options[index];
    session.answered = true;
    var isCorrect = !!selected.correct;
    if (isCorrect) session.correct += 1;
    session.results.push({question: question, selected: selected, correct: isCorrect});

    var buttons = Array.from(document.querySelectorAll("#answerGrid .answer-option"));
    buttons.forEach(function (button, buttonIndex) {
      var option = session.options[buttonIndex];
      button.disabled = true;
      if (option.correct) button.classList.add("correct");
      else if (buttonIndex === index) button.classList.add("incorrect");
    });

    var feedback = document.getElementById("answerFeedback");
    feedback.classList.remove("hidden");
    feedback.classList.toggle("wrong", !isCorrect);
    if (isCorrect) {
      feedback.innerHTML = "Chính xác — <strong>" + escapeHTML(question.label) + "</strong>. Bạn đã ghi nhớ đúng công thức.";
      document.getElementById("answerStatus").textContent = "Tốt lắm. Giữ nhịp nhé.";
    } else {
      feedback.innerHTML = "Chưa chính xác. Đáp án đúng là <strong>" + escapeHTML(question.label) + "</strong>: " + escapeHTML(getPrimaryFormula(question));
      document.getElementById("answerStatus").textContent = "Ghi nhớ đáp án rồi chuyển sang câu tiếp theo.";
    }
    document.getElementById("liveScore").textContent = session.correct;
    document.getElementById("progressFill").style.width = ((session.index + 1) / session.questions.length * 100) + "%";
    document.getElementById("nextQuestion").classList.remove("hidden");
  }

  function nextQuestion() {
    if (!session || !session.answered) return;
    if (session.index + 1 >= session.questions.length) {
      finishQuiz();
      return;
    }
    session.index += 1;
    renderQuestion();
  }

  function finishQuiz() {
    if (!session) return;
    var total = session.questions.length;
    var percent = Math.round(session.correct / total * 100);
    if (!bestRecord || percent > bestRecord.percent || (percent === bestRecord.percent && total > bestRecord.total)) {
      bestRecord = {percent: percent, total: total, correct: session.correct};
      writeStore("cubeRecallBest", bestRecord);
    }
    updatePersonalStats();
    var wrong = session.results.filter(function (result) { return !result.correct; });
    var title = percent === 100 ? "Hoàn hảo!" : percent >= 80 ? "Rất tốt!" : percent >= 50 ? "Đang tiến bộ!" : "Luyện thêm một lượt nhé.";
    var html = '<div class="summary-icon">' + (percent >= 80 ? "✳" : "↻") + '</div>' +
      '<div class="summary-eyebrow">LƯỢT LUYỆN ĐÃ HOÀN TẤT</div><h3>' + title + '</h3>' +
      '<p class="summary-subtitle">Bạn vừa hoàn thành ' + total + ' câu ' + (selectedFamily === "all" ? "OLL và PLL" : selectedFamily) + '.</p>' +
      '<div class="summary-score"><strong>' + percent + '%</strong><span>ĐIỂM SỐ</span></div>' +
      '<div class="summary-stats"><div class="summary-stat"><b>' + session.correct + '</b><span>Câu đúng</span></div><div class="summary-stat"><b>' + wrong.length + '</b><span>Câu cần ôn</span></div><div class="summary-stat"><b>' + total + '</b><span>Tổng câu</span></div></div>' +
      '<div class="summary-actions"><button class="button button-primary button-small" id="retryQuiz" type="button">Làm lượt mới <span aria-hidden="true">↻</span></button><button class="button button-quiet button-small" id="backToLearn" type="button">Về bộ công thức</button></div>';
    if (wrong.length) {
      html += '<div class="review-list"><h4>CÂU TRẢ LỜI CHƯA ĐÚNG · ÔN LẠI</h4>' + wrong.map(function (result) {
        return '<div class="review-item"><img loading="lazy" src="' + escapeHTML(getCaseImage(result.question)) + '" alt="" style="transform:' + imageTransform(result.question) + '">' +
          '<div><strong>' + escapeHTML(result.question.label) + ' · ' + escapeHTML(result.question.group) + '</strong><p>' + escapeHTML(getPrimaryFormula(result.question)) + '</p></div></div>';
      }).join("") + '</div>';
    }
    quizSummary.innerHTML = html;
    quizRun.classList.add("hidden");
    quizSummary.classList.remove("hidden");
    bindImageFallbacks(quizSummary);
    document.getElementById("retryQuiz").addEventListener("click", startQuiz);
    document.getElementById("backToLearn").addEventListener("click", function () {
      setMainMode("learn");
      setView("learn");
    });
  }

  document.querySelectorAll(".family-tab").forEach(function (tab) {
    tab.addEventListener("click", function () { setFamily(tab.dataset.family); });
  });
  document.querySelectorAll(".view-tab").forEach(function (tab) {
    tab.addEventListener("click", function () { setView(tab.dataset.view); });
  });
  document.querySelectorAll(".main-mode-tab").forEach(function (tab) {
    tab.addEventListener("click", function () { setMainMode(tab.dataset.mainMode); });
  });
  document.querySelectorAll(".quiz-kind").forEach(function (button) {
    button.addEventListener("click", function () {
      quizKind = button.dataset.quizKind;
      document.querySelectorAll(".quiz-kind").forEach(function (other) { other.classList.toggle("selected", other === button); });
    });
  });
  document.querySelectorAll(".count-options button").forEach(function (button) {
    button.addEventListener("click", function () {
      questionCount = button.dataset.count === "all" ? "all" : Number(button.dataset.count);
      document.querySelectorAll(".count-options button").forEach(function (other) { other.classList.toggle("selected", other === button); });
    });
  });

  groupFilters.addEventListener("click", function (event) {
    var button = event.target.closest("[data-group]");
    if (!button) return;
    selectedGroup = button.dataset.group;
    renderGroupFilters();
    renderLearn();
  });

  document.getElementById("flashGroupSelect").addEventListener("change", function (event) {
    flashGroup = event.target.value;
    rebuildFlashDeck(false);
  });
  document.getElementById("shuffleFlashcards").addEventListener("click", function () {
    rebuildFlashDeck(true);
  });
  document.getElementById("flashCard").addEventListener("click", flipFlashcard);
  document.getElementById("flashReveal").addEventListener("click", flipFlashcard);
  document.getElementById("flashPrevious").addEventListener("click", function () { moveFlashcard(-1); });
  document.getElementById("flashNext").addEventListener("click", function () { moveFlashcard(1); });
  document.getElementById("flashMarkMastered").addEventListener("click", function () {
    if (flashDeck.length) toggleMastered(flashDeck[flashIndex].id);
  });
  document.getElementById("newScramble").addEventListener("click", function () {
    newScramble();
    this.blur();
  });
  document.getElementById("saveScramble").addEventListener("click", function () {
    saveCurrentScramble(this);
    this.blur();
  });
  document.getElementById("savedScrambleList").addEventListener("click", function (event) {
    var loadButton = event.target.closest("[data-load-scramble]");
    if (loadButton) {
      if (timerRunning) return;
      var loadIndex = Number(loadButton.dataset.loadScramble);
      if (!isFinite(loadIndex) || !savedScrambles[loadIndex]) return;
      scrambleMoves = savedScrambles[loadIndex].trim().split(/\s+/);
      displayScramble();
      document.getElementById("timerStatus").textContent = "Đã nạp scramble đã lưu.";
      loadButton.blur();
      return;
    }
    var deleteButton = event.target.closest("[data-delete-scramble]");
    if (deleteButton) {
      var deleteIndex = Number(deleteButton.dataset.deleteScramble);
      if (!isFinite(deleteIndex) || !savedScrambles[deleteIndex]) return;
      savedScrambles.splice(deleteIndex, 1);
      writeStore("cubeRecallSavedScramblesV1", savedScrambles);
      renderSavedScrambles();
    }
  });
  document.getElementById("clearTimerHistory").addEventListener("click", clearTimerHistory);
  document.getElementById("copyScramble").addEventListener("click", function () {
    copyText(scrambleMoves.join(" "));
    var button = this;
    var originalText = button.textContent;
    button.textContent = "Đã sao chép ✓";
    button.blur();
    window.setTimeout(function () { if (document.body.contains(button)) button.textContent = originalText; }, 1200);
  });
  document.getElementById("timerStart").addEventListener("click", function () {
    if (timerRunning) stopTimer();
    else startTimer();
  });
  document.getElementById("searchInput").addEventListener("input", renderLearn);
  document.getElementById("clearSearch").addEventListener("click", function () {
    document.getElementById("searchInput").value = "";
    renderLearn();
  });
  document.getElementById("toggleFormulas").addEventListener("click", function () {
    formulasVisible = !formulasVisible;
    renderLearn();
  });

  learnGrid.addEventListener("click", function (event) {
    var setupButton = event.target.closest("[data-case-setup]");
    if (setupButton) {
      var setupItem = findItem(setupButton.dataset.caseSetup);
      if (setupItem) showCaseSetup(setupItem, setupButton);
      return;
    }
    var copySetupButton = event.target.closest("[data-copy-case-setup]");
    if (copySetupButton) {
      var setupSource = findItem(copySetupButton.dataset.copyCaseSetup);
      if (!setupSource) return;
      copyText(invertAlgorithm(getPrimaryFormula(setupSource)));
      copySetupButton.textContent = "Đã sao chép ✓";
      window.setTimeout(function () {
        if (document.body.contains(copySetupButton)) copySetupButton.textContent = "Sao chép chuỗi setup ↗";
      }, 1200);
      return;
    }
    var mirrorCopyButton = event.target.closest("[data-copy-mirror]");
    if (mirrorCopyButton) {
      var mirrorSource = findItem(mirrorCopyButton.dataset.copyMirror);
      if (!mirrorSource) return;
      copyText(mirrorAlgorithm(getPrimaryFormula(mirrorSource)));
      var mirrorOriginalText = mirrorCopyButton.textContent;
      mirrorCopyButton.textContent = "Đã sao chép ✓";
      window.setTimeout(function () {
        if (document.body.contains(mirrorCopyButton)) mirrorCopyButton.textContent = mirrorOriginalText;
      }, 1200);
      return;
    }
    var masterButton = event.target.closest("[data-master]");
    if (masterButton) {
      toggleMastered(masterButton.dataset.master);
      return;
    }
    var copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      var item = findItem(copyButton.dataset.copy);
      if (!item) return;
      copyText(getPrimaryFormula(item));
      var originalText = copyButton.textContent;
      copyButton.textContent = "Đã sao chép ✓";
      window.setTimeout(function () {
        if (document.body.contains(copyButton)) copyButton.textContent = originalText;
      }, 1200);
    }
  });

  document.getElementById("startQuiz").addEventListener("click", startQuiz);
  document.getElementById("quitQuiz").addEventListener("click", showQuizSetup);
  document.getElementById("nextQuestion").addEventListener("click", nextQuestion);
  document.getElementById("answerGrid").addEventListener("click", function (event) {
    var button = event.target.closest("[data-option]");
    if (button) selectAnswer(Number(button.dataset.option));
  });

  document.getElementById("heroStart").addEventListener("click", function () {
    setMainMode("learn");
    setView("quiz");
    document.getElementById("practice").scrollIntoView({behavior:"smooth", block:"start"});
  });
  document.getElementById("heroLearn").addEventListener("click", function () {
    setMainMode("learn");
    setView("learn");
    document.getElementById("practice").scrollIntoView({behavior:"smooth", block:"start"});
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && currentView === "learn" && document.activeElement.tagName !== "INPUT") {
      event.preventDefault();
      document.getElementById("searchInput").focus();
    }
    if (currentView === "timer" && event.code === "Space") {
      var activeTag = document.activeElement.tagName;
      var focusedTimerTab = activeTag === "BUTTON" && document.activeElement.dataset.mainMode === "timer";
      if (["INPUT","SELECT","TEXTAREA","A"].indexOf(activeTag) !== -1 || (activeTag === "BUTTON" && !focusedTimerTab)) return;
      event.preventDefault();
      if (timerRunning) {
        if (!event.repeat) stopTimer();
        return;
      }
      if (event.repeat || timerKeyHeld) return;
      timerKeyHeld = true;
      timerArmed = false;
      updateTimerMode();
      timerArmTimeout = window.setTimeout(function () {
        if (!timerKeyHeld || timerRunning) return;
        timerArmed = true;
        updateTimerMode();
        document.getElementById("timerStatus").textContent = "Đã sẵn sàng · thả Space để bắt đầu.";
      }, 300);
      return;
    }
    if (currentView === "flashcards") {
      var targetTag = document.activeElement.tagName;
      if (targetTag !== "INPUT" && targetTag !== "SELECT" && event.key === "ArrowLeft") {
        event.preventDefault();
        moveFlashcard(-1);
      } else if (targetTag !== "INPUT" && targetTag !== "SELECT" && event.key === "ArrowRight") {
        event.preventDefault();
        moveFlashcard(1);
      } else if (document.activeElement.id === "flashCard" && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        flipFlashcard();
      }
      return;
    }
    if (currentView !== "quiz" || !session) return;
    if (!session.answered && /^[1-4]$/.test(event.key)) selectAnswer(Number(event.key) - 1);
    else if (session.answered && (event.key === "Enter" || event.key === "ArrowRight")) nextQuestion();
  });

  document.addEventListener("keyup", function (event) {
    if (event.code !== "Space" || !timerKeyHeld) return;
    event.preventDefault();
    var shouldStart = timerArmed && currentView === "timer" && !timerRunning;
    cancelTimerArm();
    if (shouldStart) startTimer();
    else if (currentView === "timer" && !timerRunning) document.getElementById("timerStatus").textContent = "Giữ Space lâu hơn một chút, hoặc bấm nút để bắt đầu.";
  });

  renderGroupFilters();
  renderLearn();
  renderFlashGroupSelect();
  rebuildFlashDeck(false);
  newScramble();
  renderTimerStats();
  renderSavedScrambles();
  updateTimerMode();
  updatePersonalStats();
})();
