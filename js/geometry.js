/* ==========================================================================
   ГЕОМЕТРИЧЕСКИЙ SVG-ДВИЖОК (geometry.js)
   Математически точное построение фигур в единой координатной сетке (1 кл. = 1 см).
   Поддерживает наглядное разнесение частей в стороны как отдельных простых фигур
   со своими собственными подписанными сторонами, основаниями, высотами и углами.
   ========================================================================== */

window.GeometryEngine = (function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Создаёт SVG-элемент с набором атрибутов
   */
  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  /**
   * Вычисляет геометрический центр полигона
   */
  function getPolygonCenter(pts) {
    let sx = 0;
    let sy = 0;
    pts.forEach(([x, y]) => {
      sx += x;
      sy += y;
    });
    return [sx / pts.length, sy / pts.length];
  }

  /**
   * Вычисляет ограничивающий прямоугольник полигона в сантиметрах
   */
  function getBounds(pts) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }

  /**
   * Возвращает цвета заливки и обводки по типу фигуры
   */
  function getTypeColors(type) {
    if (type === 'rect2') return { fill: '#E0E7FF', stroke: '#4F46E5' };
    if (type === 'rect3') return { fill: '#F3E8FF', stroke: '#7C3AED' };
    if (type === 'tri1') return { fill: '#D1FAE5', stroke: '#059669' };
    if (type === 'tri2') return { fill: '#FEF3C7', stroke: '#D97706' };
    if (type === 'total') return { fill: '#DCFCE7', stroke: '#059669' };
    return { fill: '#DBEAFE', stroke: '#2563EB' };
  }

  /**
   * Нормализует точки полигона под мини-иконку (viewBox 0 0 28 20)
   */
  function normalizePointsToMiniSvg(pts, boxW = 28, boxH = 20, pad = 2.5) {
    if (!pts || pts.length === 0) return '3,3 25,3 25,17 3,17';
    const b = getBounds(pts);
    const spanX = Math.max(b.w, 1);
    const spanY = Math.max(b.h, 1);
    const availW = boxW - pad * 2;
    const availH = boxH - pad * 2;
    const sc = Math.min(availW / spanX, availH / spanY);
    const ox = (boxW - spanX * sc) / 2 - b.minX * sc;
    const oy = (boxH - spanY * sc) / 2 - b.minY * sc;
    return pts
      .map(([x, y]) => `${Math.round((ox + x * sc) * 10) / 10},${Math.round((oy + y * sc) * 10) / 10}`)
      .join(' ');
  }

  /**
   * Создаёт HTML-обозначение площади «S» с маленькой цветной фигуркой в нижнем индексе!
   * Ребёнок сразу видит, площадь какой именно фигуры (прямоугольника, треугольника или всей фигуры) находится.
   */
  function renderAreaSymbol(pts, type = 'rect1', subIndex = '') {
    const { fill, stroke } = getTypeColors(type);
    const polyPts = normalizePointsToMiniSvg(pts, 28, 20, 2.2);
    return `<span class="s-symbol-badge"><span class="s-main-char">S</span><span class="s-sub-box"><svg class="s-sub-mini-fig" viewBox="0 0 28 20" aria-hidden="true"><polygon points="${polyPts}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/></svg>${subIndex !== '' && subIndex !== null ? `<span class="s-sub-idx">${subIndex}</span>` : ''}</span></span>`;
  }

  /**
   * Форматирует строку вычисления части (например, S₁ = 6 × 4 = 24 см²)
   * так, чтобы вместо обычного S₁ стоял символ S с маленькой фигуркой этой части внизу!
   */
  function renderPartCalcWithIcon(part, idx = 0) {
    const sym = renderAreaSymbol(part.points, part.type, idx + 1);
    const rhs = (part.calcText || '').replace(/^S[₁₂₃₄₅12345]?\s*=\s*/, '');
    return `${sym} <span>= ${rhs}</span>`;
  }

  /**
   * Форматирует итоговую формулу сложения (например, S_[вся фигура] = S_[фиг1] + S_[фиг2] = 24 + 12 = 36 см²)
   */
  function renderTotalCalcWithIcons(figure, customTotalArea) {
    const parts = figure.parts || [];
    const totalArea =
      customTotalArea !== undefined
        ? customTotalArea
        : parts.reduce((acc, p) => acc + (p.area || 0), 0);
    const totalSym = renderAreaSymbol(figure.outerContour || (parts[0] && parts[0].points), 'total', '');

    if (parts.length <= 1 && parts[0]) {
      const rhs = (parts[0].calcText || '').replace(/^S[₁₂₃₄₅12345]?\s*=\s*/, '');
      return `${totalSym} <span>= ${rhs}</span>`;
    }

    const symSum = parts.map((p, i) => renderAreaSymbol(p.points, p.type, i + 1)).join(' + ');
    const numSum = parts.map((p) => p.area).join(' + ');
    return `${totalSym} <span>=</span> ${symSum} <span>= ${numSum} = <strong>${totalArea} см²</strong></span>`;
  }

  /**
   * Генерирует блок «📋 Условие задачи (Дано / Найти)» для боковой панели
   * с маленькими иконками фигур возле каждого обозначения площади
   */
  function renderConditionBoxHTML(figure, customNote = '') {
    const isL1Tri = figure.id === 'L1_TRI';
    const parts = isL1Tri ? [figure.parts[0]] : figure.parts || [];
    const totalSym = isL1Tri
      ? renderAreaSymbol(figure.parts[0].points, 'tri1', '')
      : renderAreaSymbol(figure.outerContour || (parts[0] && parts[0].points), 'total', '');

    const givenRows = parts
      .map((p, i) => {
        const sym = renderAreaSymbol(p.points, p.type, parts.length > 1 ? i + 1 : '');
        const b = getBounds(p.points);
        const isTri = p.type && p.type.startsWith('tri');
        const hasDimsInName = /см|\d/.test(p.name || '');
        const dimsDesc = isTri
          ? `основание a = ${b.w} см, высота h = ${b.h} см`
          : `длина a = ${b.w} см, ширина b = ${b.h} см`;
        return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${sym} <span>— <strong>${p.name}</strong>${hasDimsInName ? '' : ` (${dimsDesc})`}</span>
        </div>`;
      })
      .join('');

    return `
      <div class="task-condition-box">
        <div class="task-condition-header">
          <span>📋 Условие задачи (Дано)</span>
          <span>${parts.length > 1 ? `Составная фигура (${parts.length} ч.)` : 'Простая фигура'}</span>
        </div>
        ${customNote ? `<div style="font-size:var(--fs-xs);color:var(--text-secondary);">${customNote}</div>` : ''}
        <div class="task-condition-list">
          ${givenRows}
        </div>
        <div class="task-condition-find">
          <span>Найти:</span> ${totalSym} <span>— ${isL1Tri ? 'площадь треугольника (см²)' : 'общую площадь фигуры (см²)'}</span>
        </div>
      </div>
    `;
  }

  /**
   * Автоматическое масштабирование фигуры под размер SVG-холста (860 × 460)
   * с запасом места по краям, чтобы при разнесении частей в стороны они были
   * полностью видны вместе со своими подписями сторон.
   */
  function computeTransform(figure, viewW = 860, viewH = 460, padding = 88) {
    const allPts = [];
    if (figure.outerContour) {
      figure.outerContour.forEach((p) => allPts.push(p));
    }
    if (figure.parts) {
      figure.parts.forEach((part) => {
        part.points.forEach((p) => allPts.push(p));
      });
    }
    if (allPts.length === 0) {
      return { scale: 40, offsetX: 120, offsetY: 65, minX: 0, maxX: 10, minY: 0, maxY: 6 };
    }

    const { minX, maxX, minY, maxY } = getBounds(allPts);
    const spanX = Math.max(maxX - minX, 2);
    const spanY = Math.max(maxY - minY, 2);

    const availW = viewW - padding * 2;
    const availH = viewH - padding * 2;
    const scale = Math.min(availW / spanX, availH / spanY, 48);

    const figW = spanX * scale;
    const figH = spanY * scale;
    const offsetX = (viewW - figW) / 2 - minX * scale;
    const offsetY = (viewH - figH) / 2 - minY * scale;

    return {
      scale,
      offsetX,
      offsetY,
      minX,
      maxX,
      minY,
      maxY,
      px: (x) => Math.round((offsetX + x * scale) * 10) / 10,
      py: (y) => Math.round((offsetY + y * scale) * 10) / 10
    };
  }

  /**
   * Рисует фоновую сантиметровую сетку (1 клетка = 1 см × 1 см)
   * Оптимизировано для электронных досок: вся сетка рисуется двумя едиными <path>
   */
  function renderGrid(svg, tf, viewW = 860, viewH = 460) {
    const gridGroup = createSvgEl('g', { class: 'geo-background-grid' });
    const step = tf.scale;

    let minorPath = '';
    let majorPath = '';

    const startCol = Math.floor(-tf.offsetX / step) - 1;
    const endCol = Math.ceil((viewW - tf.offsetX) / step) + 1;
    for (let c = startCol; c <= endCol; c++) {
      const x = tf.px(c);
      if (x >= 0 && x <= viewW) {
        const seg = `M${x},0V${viewH}`;
        if (c % 5 === 0) majorPath += seg;
        else minorPath += seg;
      }
    }

    const startRow = Math.floor(-tf.offsetY / step) - 1;
    const endRow = Math.ceil((viewH - tf.offsetY) / step) + 1;
    for (let r = startRow; r <= endRow; r++) {
      const y = tf.py(r);
      if (y >= 0 && y <= viewH) {
        const seg = `M0,${y}H${viewW}`;
        if (r % 5 === 0) majorPath += seg;
        else minorPath += seg;
      }
    }

    if (minorPath) {
      gridGroup.appendChild(
        createSvgEl('path', {
          d: minorPath,
          stroke: '#E2E8F0',
          'stroke-width': '0.8',
          fill: 'none'
        })
      );
    }
    if (majorPath) {
      gridGroup.appendChild(
        createSvgEl('path', {
          d: majorPath,
          stroke: '#CBD5E1',
          'stroke-width': '1.3',
          fill: 'none'
        })
      );
    }

    const scaleBadge = createSvgEl('g', { transform: `translate(14, ${viewH - 34})` });
    scaleBadge.appendChild(
      createSvgEl('rect', {
        x: 0,
        y: 0,
        width: 156,
        height: 24,
        rx: 6,
        fill: '#FFFFFF',
        stroke: '#CBD5E1',
        'stroke-width': '1.2'
      })
    );
    scaleBadge.appendChild(
      createSvgEl('rect', {
        x: 8,
        y: 5,
        width: 14,
        height: 14,
        fill: '#DBEAFE',
        stroke: '#2563EB',
        'stroke-width': '1.5'
      })
    );
    const scaleTxt = createSvgEl('text', {
      x: 28,
      y: 16,
      fill: '#475569',
      'font-size': '12',
      'font-weight': '700',
      'font-family': 'Segoe UI, sans-serif'
    });
    scaleTxt.textContent = '1 клетка сетки = 1 см';
    scaleBadge.appendChild(scaleTxt);
    gridGroup.appendChild(scaleBadge);

    svg.appendChild(gridGroup);
  }

  /**
   * Рисует компактную плашку размера на стороне отдельной части
   */
  function createSidePill(x, y, textStr, strokeColor, bgColor = '#FFFFFF') {
    const g = createSvgEl('g');
    const boxW = Math.max(textStr.length * 8.6 + 12, 46);
    const boxH = 22;
    g.appendChild(
      createSvgEl('rect', {
        x: x - boxW / 2,
        y: y - boxH / 2,
        width: boxW,
        height: boxH,
        rx: 6,
        fill: bgColor,
        stroke: strokeColor,
        'stroke-width': '1.8'
      })
    );
    const txt = createSvgEl('text', {
      x,
      y: y + 4.5,
      'text-anchor': 'middle',
      fill: strokeColor,
      'font-size': '13',
      'font-weight': '800',
      'font-family': 'Segoe UI, sans-serif'
    });
    txt.textContent = textStr;
    g.appendChild(txt);
    return g;
  }

  /**
   * Создаёт индивидуальные обозначения сторон и прямых углов для отдельной части,
   * чтобы когда части расходятся в стороны, ребёнок видел каждую простую фигуру
   * со всеми её сторонами, основанием, высотой и прямыми углами!
   */
  function createPartOwnDetails(part, tf) {
    const g = createSvgEl('g', { class: 'geo-part-own-details' });
    const isTri = part.type && part.type.startsWith('tri');
    const strokeColor =
      part.type === 'rect2'
        ? '#4F46E5'
        : part.type === 'rect3'
        ? '#7C3AED'
        : part.type === 'tri1'
        ? '#059669'
        : part.type === 'tri2'
        ? '#D97706'
        : '#2563EB';

    const b = getBounds(part.points);
    const xMin = tf.px(b.minX);
    const xMax = tf.px(b.maxX);
    const yMin = tf.py(b.minY);
    const yMax = tf.py(b.maxY);

    if (!isTri && part.points.length === 4) {
      // 1. Маленькие уголки прямых углов в вершинах прямоугольника
      const sq = 9;
      const corners = [
        [xMin, yMin, sq, sq],
        [xMax, yMin, -sq, sq],
        [xMax, yMax, -sq, -sq],
        [xMin, yMax, sq, -sq]
      ];
      corners.forEach(([cx, cy, dx, dy]) => {
        g.appendChild(
          createSvgEl('polyline', {
            points: `${cx + dx},${cy} ${cx + dx},${cy + dy} ${cx},${cy + dy}`,
            fill: 'none',
            stroke: strokeColor,
            'stroke-width': '1.6',
            opacity: '0.65'
          })
        );
      });

      // 2. Подпись горизонтальной стороны прямоугольника (сверху или снизу)
      const [sepDx, sepDy] = part.sepOffset || [0, 0];
      const horizY = sepDy >= 0 ? yMax + 16 : yMin - 16;
      g.appendChild(createSidePill((xMin + xMax) / 2, horizY, `${b.w} см`, strokeColor));

      // 3. Подпись вертикальной стороны прямоугольника (смещена выше центральной плашки, чтобы не пересекаться с ней на узких башнях)
      const vertX = sepDx >= 0 ? xMax + 28 : xMin - 28;
      const vertY = yMin + (yMax - yMin) * 0.22;
      g.appendChild(createSidePill(vertX, vertY, `${b.h} см`, strokeColor));
    } else if (isTri && part.points.length === 3) {
      // Для треугольника подписываем основание и высоту прямо на самой фигуре (без дублирования, если у heightLine уже есть подпись)
      const [sepDx, sepDy] = part.sepOffset || [0, 0];
      const hasExistingHeightLabel = part.heightLine && part.heightLine.label;
      const pts = part.points;
      const horizPair =
        pts[0][1] === pts[1][1]
          ? [pts[0], pts[1], pts[2]]
          : pts[1][1] === pts[2][1]
          ? [pts[1], pts[2], pts[0]]
          : pts[0][1] === pts[2][1]
          ? [pts[0], pts[2], pts[1]]
          : null;

      if (horizPair) {
        const [pA, pB, pApex] = horizPair;
        const baseLen = Math.abs(pB[0] - pA[0]);
        const heightLen = Math.abs(pApex[1] - pA[1]);
        const bx = (tf.px(pA[0]) + tf.px(pB[0])) / 2;
        const by = tf.py(pA[1]) + (pA[1] >= pApex[1] ? 16 : -16);
        g.appendChild(createSidePill(bx, by, `a = ${baseLen} см`, strokeColor));

        if (!hasExistingHeightLabel) {
          const hx = (sepDx >= 0 ? xMax + 34 : xMin - 34);
          const hy = Math.max(tf.py(pA[1]), tf.py(pApex[1])) - 8;
          g.appendChild(createSidePill(hx, hy, `h = ${heightLen} см`, '#0284C7', '#F0F9FF'));
        }
      } else {
        const bx = sepDx >= 0 ? xMin - 32 : xMax + 32;
        const by = (yMin + yMax) / 2;
        if (!hasExistingHeightLabel) {
          g.appendChild(createSidePill(bx, by, `a = ${b.h} см`, strokeColor));
        }
        g.appendChild(
          createSidePill((xMin + xMax) / 2, yMax + 16, `h = ${b.w} см`, '#0284C7', '#F0F9FF')
        );
      }
    }

    return g;
  }

  /**
   * Рисует аккуратную выносную размерную линию со стрелками/засечками и плашкой текста
   */
  function createDimensionElement(dim, tf) {
    const g = createSvgEl('g', { class: 'geo-dim-group visible' });
    const x1 = tf.px(dim.x1);
    const y1 = tf.py(dim.y1);
    const x2 = tf.px(dim.x2);
    const y2 = tf.py(dim.y2);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (dim.offsetPx || 0);
    const ny = (dx / len) * (dim.offsetPx || 0);

    const sx1 = x1 + nx;
    const sy1 = y1 + ny;
    const sx2 = x2 + nx;
    const sy2 = y2 + ny;

    const color = dim.color || '#1E293B';

    if (dim.offsetPx && Math.abs(dim.offsetPx) > 6) {
      g.appendChild(
        createSvgEl('line', {
          x1,
          y1,
          x2: sx1,
          y2: sy1,
          stroke: '#94A3B8',
          'stroke-width': '1.4',
          'stroke-dasharray': '3 3'
        })
      );
      g.appendChild(
        createSvgEl('line', {
          x1: x2,
          y1: y2,
          x2: sx2,
          y2: sy2,
          stroke: '#94A3B8',
          'stroke-width': '1.4',
          'stroke-dasharray': '3 3'
        })
      );
    }

    g.appendChild(
      createSvgEl('line', {
        x1: sx1,
        y1: sy1,
        x2: sx2,
        y2: sy2,
        stroke: color,
        'stroke-width': '2.2'
      })
    );

    const tx = (-dy / len) * 5;
    const ty = (dx / len) * 5;
    g.appendChild(
      createSvgEl('line', {
        x1: sx1 - tx,
        y1: sy1 - ty,
        x2: sx1 + tx,
        y2: sy1 + ty,
        stroke: color,
        'stroke-width': '2.4'
      })
    );
    g.appendChild(
      createSvgEl('line', {
        x1: sx2 - tx,
        y1: sy2 - ty,
        x2: sx2 + tx,
        y2: sy2 + ty,
        stroke: color,
        'stroke-width': '2.4'
      })
    );

    const mx = (sx1 + sx2) / 2 + (dim.labelDx || 0);
    const my = (sy1 + sy2) / 2 + (dim.labelDy || 0);
    const textStr = dim.text;
    const boxW = Math.max(textStr.length * 9.5 + 14, 52);
    const boxH = 26;

    g.appendChild(
      createSvgEl('rect', {
        x: mx - boxW / 2,
        y: my - boxH / 2,
        width: boxW,
        height: boxH,
        rx: 7,
        fill: dim.bg || '#FFFFFF',
        stroke: color,
        'stroke-width': '1.8'
      })
    );

    const txt = createSvgEl('text', {
      x: mx,
      y: my + 5,
      'text-anchor': 'middle',
      fill: color,
      'font-size': '14.5',
      'font-weight': '800',
      'font-family': 'Segoe UI, sans-serif'
    });
    txt.textContent = textStr;
    g.appendChild(txt);

    return g;
  }

  /**
   * Рисует высоту треугольника (пунктир) и обозначение прямого угла (квадратик с точкой)
   */
  function createHeightElement(hInfo, tf, visibleByDefault = false) {
    const g = createSvgEl('g', {
      class: `geo-height-group ${visibleByDefault ? 'visible' : ''}`
    });

    const x1 = tf.px(hInfo.x1);
    const y1 = tf.py(hInfo.y1);
    const x2 = tf.px(hInfo.x2);
    const y2 = tf.py(hInfo.y2);

    g.appendChild(
      createSvgEl('line', {
        x1,
        y1,
        x2,
        y2,
        class: 'geo-height-line'
      })
    );

    if (hInfo.rightAngle) {
      const rx = tf.px(hInfo.rightAngle.x);
      const ry = tf.py(hInfo.rightAngle.y);
      const size = 13;
      const dx = (hInfo.rightAngle.dirX || 1) * size;
      const dy = (hInfo.rightAngle.dirY || -1) * size;

      const pts = [
        `${rx},${ry}`,
        `${rx + dx},${ry}`,
        `${rx + dx},${ry + dy}`,
        `${rx},${ry + dy}`
      ].join(' ');

      g.appendChild(
        createSvgEl('polygon', {
          points: pts,
          class: 'geo-right-angle-mark'
        })
      );

      g.appendChild(
        createSvgEl('circle', {
          cx: rx + dx * 0.45,
          cy: ry + dy * 0.45,
          r: 1.8,
          fill: '#0284C7'
        })
      );
    }

    if (hInfo.label) {
      const mx = (x1 + x2) / 2 + (hInfo.labelDx || 0);
      const my = (y1 + y2) / 2 + (hInfo.labelDy || 0);
      const boxW = Math.max(hInfo.label.length * 9 + 14, 58);
      const boxH = 25;

      g.appendChild(
        createSvgEl('rect', {
          x: mx - boxW / 2,
          y: my - boxH / 2,
          width: boxW,
          height: boxH,
          rx: 6,
          fill: '#F0F9FF',
          stroke: '#0284C7',
          'stroke-width': '1.8'
        })
      );

      const txt = createSvgEl('text', {
        x: mx,
        y: my + 5,
        'text-anchor': 'middle',
        fill: '#0369A1',
        'font-size': '13.5',
        'font-weight': '800',
        'font-family': 'Segoe UI, sans-serif'
      });
      txt.textContent = hInfo.label;
      g.appendChild(txt);
    }

    return g;
  }

  /**
   * Полная отрисовка интерактивной геометрической сцены в указанный SVG-элемент.
   */
  function renderScene(svgEl, figure, options = {}) {
    const viewW = options.viewW || 860;
    const viewH = options.viewH || 460;
    const padding = options.padding || 86;

    svgEl.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
    svgEl.innerHTML = '';

    const tf = computeTransform(figure, viewW, viewH, padding);
    let separatedState = false;

    // 1. Фоновая координатная сетка
    if (options.showGrid !== false) {
      renderGrid(svgEl, tf, viewW, viewH);
    }

    // 2. Слой общего внешнего контура фигуры (при разъединении частей остаётся лёгким пунктирным силуэтом в центре)
    const contourLayer = createSvgEl('g', { class: 'layer-contour' });
    let outerPoly = null;
    if (figure.outerContour && figure.outerContour.length > 0) {
      const ptsStr = figure.outerContour.map(([x, y]) => `${tf.px(x)},${tf.py(y)}`).join(' ');
      outerPoly = createSvgEl('polygon', {
        points: ptsStr,
        class: 'geo-outer-contour visible',
        'pointer-events': 'none'
      });
      contourLayer.appendChild(outerPoly);
    }
    svgEl.appendChild(contourLayer);

    // 3. Слой единичных клеток (для Уровня 1: заполнение прямоугольника 6 × 4 клетками)
    const unitCellsLayer = createSvgEl('g', { class: 'layer-unit-cells' });
    const unitCellEls = [];
    if (figure.unitCells) {
      const { cols, rows, startX = 0, startY = 0 } = figure.unitCells;
      for (let r = 0; r < rows; r++) {
        const rowCells = [];
        for (let c = 0; c < cols; c++) {
          const cellRect = createSvgEl('rect', {
            x: tf.px(startX + c) + 1.5,
            y: tf.py(startY + r) + 1.5,
            width: Math.max(tf.scale - 3, 4),
            height: Math.max(tf.scale - 3, 4),
            rx: 4,
            class: `unit-cell ${r === 0 ? 'first-row-highlight' : ''}`,
            'data-row': r,
            'data-col': c
          });
          unitCellsLayer.appendChild(cellRect);
          rowCells.push(cellRect);
        }
        unitCellEls.push(rowCells);
      }
    }

    // 4. Слой частей фигуры (Прямоугольники и Треугольники)
    const partsLayer = createSvgEl('g', { class: 'layer-parts' });
    const partControllers = {};

    (figure.parts || []).forEach((part, idx) => {
      const partGroup = createSvgEl('g', {
        class: `geo-part-group uncoloured type-${part.type || 'rect1'}`,
        'data-part-id': part.id
      });

      const ptsStr = part.points.map(([x, y]) => `${tf.px(x)},${tf.py(y)}`).join(' ');
      const poly = createSvgEl('polygon', {
        points: ptsStr,
        class: 'geo-part-shape'
      });
      partGroup.appendChild(poly);

      // Высота треугольника
      let heightEl = null;
      if (part.heightLine) {
        heightEl = createHeightElement(part.heightLine, tf, !!options.showHeightsImmediately);
        partGroup.appendChild(heightEl);
      }

      // Собственный прямой угол части
      let rightAngleEl = null;
      if (part.rightAngle && !part.heightLine) {
        rightAngleEl = createHeightElement(
          {
            x1: part.rightAngle.x,
            y1: part.rightAngle.y,
            x2: part.rightAngle.x,
            y2: part.rightAngle.y,
            rightAngle: part.rightAngle
          },
          tf,
          !!options.showHeightsImmediately
        );
        partGroup.appendChild(rightAngleEl);
      }

      // Индивидуальные подписи сторон/основания/высоты и уголков этой части (когда она уходит в сторону!)
      const ownDetailsEl = createPartOwnDetails(part, tf);
      partGroup.appendChild(ownDetailsEl);

      // Плашка названия фигуры и её площади в геометрическом центре части
      const [cx, cy] = getPolygonCenter(part.points);
      const badgeX = tf.px(cx) + (part.badgeDx || 0);
      const badgeY = tf.py(cy) + (part.badgeDy || 0);

      const badgeGroup = createSvgEl('g', { class: 'geo-part-badge' });
      const shapeTypeWord = part.type && part.type.startsWith('tri') ? 'Треугольник' : 'Прямоугольник';
      const labelText = part.shortLabel || `${shapeTypeWord} S${idx + 1}`;
      const subText = (part.dimSummary || '').replace(/^S[₁₂₃₄₅12345]?\s*=\s*/, '');
      const iconColW = 36;
      const textColW = Math.max(labelText.length * 8.8 + 16, subText.length * 8.0 + 16, 70);
      const badgeW = iconColW + textColW + 12;
      const badgeH = subText ? 46 : 32;
      const { fill: typeFill, stroke: typeStroke } = getTypeColors(part.type);

      badgeGroup.appendChild(
        createSvgEl('rect', {
          x: badgeX - badgeW / 2,
          y: badgeY - badgeH / 2,
          width: badgeW,
          height: badgeH,
          rx: 9,
          fill: 'rgba(255, 255, 255, 0.96)',
          stroke: typeStroke,
          'stroke-width': '2'
        })
      );

      // Символ S с маленькой фигуркой внизу прямо на чертеже!
      const symOriginX = badgeX - badgeW / 2 + 10;
      const symOriginY = badgeY + 2;
      const sCharEl = createSvgEl('text', {
        x: symOriginX,
        y: symOriginY,
        fill: '#0F172A',
        'font-size': '17',
        'font-weight': '900',
        'font-style': 'italic',
        'font-family': 'Cambria Math, Segoe UI, serif'
      });
      sCharEl.textContent = 'S';
      badgeGroup.appendChild(sCharEl);

      const miniSubG = createSvgEl('g', {
        transform: `translate(${symOriginX + 11}, ${symOriginY - 5})`
      });
      miniSubG.appendChild(
        createSvgEl('polygon', {
          points: normalizePointsToMiniSvg(part.points, 20, 14, 1.5),
          fill: typeFill,
          stroke: typeStroke,
          'stroke-width': '1.8',
          'stroke-linejoin': 'round'
        })
      );
      badgeGroup.appendChild(miniSubG);

      const textCenterX = badgeX + iconColW / 2 - 2;
      const t1 = createSvgEl('text', {
        x: textCenterX,
        y: subText ? badgeY - 4 : badgeY + 5,
        'text-anchor': 'middle',
        fill: '#0F172A',
        'font-size': '13',
        'font-weight': '800',
        'font-family': 'Segoe UI, sans-serif'
      });
      t1.textContent = labelText;
      badgeGroup.appendChild(t1);

      if (subText) {
        const t2 = createSvgEl('text', {
          x: textCenterX,
          y: badgeY + 14,
          'text-anchor': 'middle',
          fill: '#475569',
          'font-size': '12.5',
          'font-weight': '700',
          'font-family': 'Segoe UI, sans-serif'
        });
        t2.textContent = subText;
        badgeGroup.appendChild(t2);
      }

      partGroup.appendChild(badgeGroup);

      const pcObj = {
        part,
        groupEl: partGroup,
        badgeEl: badgeGroup,
        ownDetailsEl,
        heightEl: heightEl || rightAngleEl,
        currentDx: 0,
        currentDy: 0
      };

      // ======================================================================
      // ПРЯМОЕ ПЕРЕТАСКИВАНИЕ И РАЗДЕЛЕНИЕ ФИГУР ПАЛЬЦЕМ НА ДОСКЕ (Pointer Events)
      // Ученик или учитель может просто потянуть любую часть пальцем в сторону,
      // чтобы отделить её от общей фигуры, рассмотреть её стороны и примагнитить обратно!
      // ======================================================================
      let pointerActive = false;
      let activePointerId = null;
      let startClientX = 0;
      let startClientY = 0;
      let startDx = 0;
      let startDy = 0;
      let movedEnoughToDrag = false;

      partGroup.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        pointerActive = true;
        activePointerId = e.pointerId;
        startClientX = e.clientX;
        startClientY = e.clientY;
        startDx = pcObj.currentDx;
        startDy = pcObj.currentDy;
        movedEnoughToDrag = false;

        try {
          partGroup.setPointerCapture(e.pointerId);
        } catch (err) {}

        // Поднимаем перетаскиваемую часть поверх остальных частей
        if (partsLayer.lastElementChild !== partGroup) {
          partsLayer.appendChild(partGroup);
        }
      });

      partGroup.addEventListener('pointermove', (e) => {
        if (!pointerActive || e.pointerId !== activePointerId) return;

        const screenDx = e.clientX - startClientX;
        const screenDy = e.clientY - startClientY;
        const distScreen = Math.hypot(screenDx, screenDy);

        if (!movedEnoughToDrag && distScreen > 6) {
          movedEnoughToDrag = true;
          partGroup.classList.add('dragging-now', 'separated-shadow');

          // Если в приложении шла авто-анимация, ставим её на паузу
          if (window.AnimationTimeline && typeof window.AnimationTimeline.pause === 'function') {
            window.AnimationTimeline.pause();
          }

          // Автоматически включаем режим разделения фигуры прямо под пальцем!
          separatedState = true;
          controller.colorParts();
          controller.drawSplitLines();
          if (outerPoly) outerPoly.classList.add('faded');
          if ((figure.parts || []).length > 1) {
            dimsLayer.classList.add('hidden-on-separate');
            splitLinesLayer.classList.add('faded-on-separate');
          }

          // Показываем индивидуальные размеры и формулу у оттягиваемой части
          pcObj.badgeEl.classList.add('visible');
          if (pcObj.ownDetailsEl && (figure.parts || []).length > 1) {
            pcObj.ownDetailsEl.classList.add('visible');
          }
          if (pcObj.heightEl) {
            pcObj.heightEl.classList.add('visible');
          }
          updateDragHintBadge();
        }

        if (movedEnoughToDrag) {
          const rect = svgEl.getBoundingClientRect();
          const uniformScale =
            rect.width > 0 && rect.height > 0
              ? Math.max(viewW / rect.width, viewH / rect.height)
              : 1;

          const rawDx = startDx + screenDx * uniformScale;
          const rawDy = startDy + screenDy * uniformScale;

          // Мягкое ограничение, чтобы фигуру нельзя было увести за пределы экрана доски или телефона
          const clampedDx = Math.max(-280, Math.min(280, Math.round(rawDx)));
          const clampedDy = Math.max(-180, Math.min(180, Math.round(rawDy)));

          pcObj.currentDx = clampedDx;
          pcObj.currentDy = clampedDy;
          partGroup.style.transform = `translate3d(${clampedDx}px, ${clampedDy}px, 0px)`;
        }
      });

      function finishPointerInteraction(e) {
        if (!pointerActive || (e && e.pointerId !== undefined && e.pointerId !== activePointerId)) return;
        pointerActive = false;
        partGroup.classList.remove('dragging-now');

        try {
          if (activePointerId !== null) {
            partGroup.releasePointerCapture(activePointerId);
          }
        } catch (err) {}
        activePointerId = null;

        if (movedEnoughToDrag) {
          // Магнитное притяжение: если часть вернули близко к исходному месту (< 26px),
          // она плавно «примагничивается» точно в контур (0, 0)!
          if (Math.hypot(pcObj.currentDx, pcObj.currentDy) < 26) {
            pcObj.currentDx = 0;
            pcObj.currentDy = 0;
            partGroup.style.transform = 'translate3d(0px, 0px, 0px)';
            partGroup.classList.remove('separated-shadow');
            if (pcObj.ownDetailsEl) {
              pcObj.ownDetailsEl.classList.remove('visible');
            }
          }

          // Проверяем, остались ли ещё отодвинутые части
          const anyStillMoved = Object.values(partControllers).some(
            (item) => Math.hypot(item.currentDx || 0, item.currentDy || 0) >= 26
          );
          separatedState = anyStillMoved;

          if (!anyStillMoved) {
            if (outerPoly) outerPoly.classList.remove('faded');
            dimsLayer.classList.remove('hidden-on-separate');
            splitLinesLayer.classList.remove('faded-on-separate');
          }
          updateDragHintBadge();

          const dockSepBtn = document.getElementById('dockSeparateToggleBtn');
          if (dockSepBtn) {
            dockSepBtn.textContent = separatedState ? '↩ Собрать обратно' : '↔ Разнести в стороны';
          }
        } else {
          // Обычное короткое нажатие пальцем без перетаскивания
          if (typeof options.onPartClick === 'function') {
            options.onPartClick(part, idx);
          } else {
            controller.highlightPart(part.id);
          }
        }
      }

      partGroup.addEventListener('pointerup', finishPointerInteraction);
      partGroup.addEventListener('pointercancel', finishPointerInteraction);

      partsLayer.appendChild(partGroup);
      partControllers[part.id] = pcObj;
    });

    svgEl.appendChild(partsLayer);
    svgEl.appendChild(unitCellsLayer);

    // 5. Слой линий разделения
    const splitLinesLayer = createSvgEl('g', { class: 'layer-split-lines' });
    const splitLineControllers = [];

    (figure.splitLines || []).forEach((lineDef) => {
      const x1 = tf.px(lineDef.x1);
      const y1 = tf.py(lineDef.y1);
      const x2 = tf.px(lineDef.x2);
      const y2 = tf.py(lineDef.y2);
      const length = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) + 10;

      const lineEl = createSvgEl('line', {
        x1,
        y1,
        x2,
        y2,
        class: 'geo-split-line',
        style: `--line-len: ${length}; stroke-dasharray: ${length}; stroke-dashoffset: ${length};`
      });

      const dashedOverlay = createSvgEl('line', {
        x1,
        y1,
        x2,
        y2,
        class: 'geo-split-line-dashed-overlay'
      });

      const pStart = createSvgEl('circle', {
        cx: x1,
        cy: y1,
        r: 5,
        fill: '#E11D48',
        opacity: '0'
      });
      const pEnd = createSvgEl('circle', {
        cx: x2,
        cy: y2,
        r: 5,
        fill: '#E11D48',
        opacity: '0'
      });

      splitLinesLayer.appendChild(lineEl);
      splitLinesLayer.appendChild(dashedOverlay);
      splitLinesLayer.appendChild(pStart);
      splitLinesLayer.appendChild(pEnd);

      splitLineControllers.push({
        def: lineDef,
        lineEl,
        dashedOverlay,
        pStart,
        pEnd,
        length
      });
    });
    svgEl.appendChild(splitLinesLayer);

    // 6. Слой интерактивных линий-кандидатов разреза (для Уровня 5)
    const candidateCutsLayer = createSvgEl('g', { class: 'layer-candidate-cuts' });
    const candidateControllers = [];
    if (figure.candidateCuts && options.enableInteractiveCuts) {
      figure.candidateCuts.forEach((cut) => {
        const x1 = tf.px(cut.x1);
        const y1 = tf.py(cut.y1);
        const x2 = tf.px(cut.x2);
        const y2 = tf.py(cut.y2);

        const cg = createSvgEl('g', {
          class: 'candidate-cut-group',
          'data-cut-id': cut.id
        });

        const hitLine = createSvgEl('line', {
          x1,
          y1,
          x2,
          y2,
          class: 'candidate-cut-hitarea'
        });

        const visLine = createSvgEl('line', {
          x1,
          y1,
          x2,
          y2,
          class: 'candidate-cut-visual'
        });

        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const handleCircle = createSvgEl('circle', {
          cx: mx,
          cy: my,
          r: 16,
          fill: '#FFFFFF',
          stroke: '#E11D48',
          'stroke-width': '3'
        });
        const handleIcon = createSvgEl('text', {
          x: mx,
          y: my + 5,
          'text-anchor': 'middle',
          fill: '#E11D48',
          'font-size': '14',
          'font-weight': '900'
        });
        handleIcon.textContent = '✂';

        cg.appendChild(hitLine);
        cg.appendChild(visLine);
        cg.appendChild(handleCircle);
        cg.appendChild(handleIcon);

        cg.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof options.onCutSelect === 'function') {
            options.onCutSelect(cut, cg);
          }
        });

        candidateCutsLayer.appendChild(cg);
        candidateControllers.push({ cut, groupEl: cg });
      });
    }
    svgEl.appendChild(candidateCutsLayer);

    // 7. Слой выделяемых вершин
    const verticesLayer = createSvgEl('g', { class: 'layer-vertices' });
    const vertexEls = [];
    if (figure.keyVertices) {
      figure.keyVertices.forEach(([vx, vy]) => {
        const c = createSvgEl('circle', {
          cx: tf.px(vx),
          cy: tf.py(vy),
          r: 7,
          class: 'geo-vertex-point',
          opacity: '0'
        });
        verticesLayer.appendChild(c);
        vertexEls.push(c);
      });
    }
    svgEl.appendChild(verticesLayer);

    // 8. Слой внешних размеров исходной фигуры
    const dimsLayer = createSvgEl('g', { class: 'layer-dimensions' });
    const dimEls = [];
    (figure.dimensions || []).forEach((dim) => {
      const dEl = createDimensionElement(dim, tf);
      dimsLayer.appendChild(dEl);
      dimEls.push(dEl);
    });
    svgEl.appendChild(dimsLayer);

    // 9. Интерактивная плашка-подсказка в правом нижнем углу чертежа (для фигур из 2+ частей):
    // показывает, что части можно тянуть пальцем, и позволяет одним касанием собрать их на место
    let dragHintTextEl = null;
    let dragHintRectEl = null;
    function updateDragHintBadge() {
      if (!dragHintTextEl || !dragHintRectEl) return;
      if (separatedState) {
        dragHintTextEl.textContent = '↩ Коснись здесь, чтобы собрать фигуры на место';
        dragHintRectEl.setAttribute('stroke', '#2563EB');
        dragHintRectEl.setAttribute('fill', '#EFF6FF');
        dragHintTextEl.setAttribute('fill', '#1D4ED8');
      } else {
        dragHintTextEl.textContent = '🖐 Тяни части фигуры пальцем в стороны!';
        dragHintRectEl.setAttribute('stroke', '#CBD5E1');
        dragHintRectEl.setAttribute('fill', '#FFFFFF');
        dragHintTextEl.setAttribute('fill', '#334155');
      }
    }

    if ((figure.parts || []).length > 1 && options.showGrid !== false) {
      const hintW = 305;
      const hintH = 28;
      const hintGroup = createSvgEl('g', {
        transform: `translate(${viewW - hintW - 14}, ${viewH - 36})`,
        style: 'cursor: pointer;'
      });
      dragHintRectEl = createSvgEl('rect', {
        x: 0,
        y: 0,
        width: hintW,
        height: hintH,
        rx: 8,
        fill: '#FFFFFF',
        stroke: '#CBD5E1',
        'stroke-width': '1.5'
      });
      dragHintTextEl = createSvgEl('text', {
        x: hintW / 2,
        y: 18,
        'text-anchor': 'middle',
        fill: '#334155',
        'font-size': '12.5',
        'font-weight': '800',
        'font-family': 'Segoe UI, sans-serif'
      });
      dragHintTextEl.textContent = '🖐 Тяни части фигуры пальцем в стороны!';
      hintGroup.appendChild(dragHintRectEl);
      hintGroup.appendChild(dragHintTextEl);

      hintGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        controller.toggleSeparate();
        const dockSepBtn = document.getElementById('dockSeparateToggleBtn');
        if (dockSepBtn) {
          dockSepBtn.textContent = separatedState ? '↩ Собрать обратно' : '↔ Разнести в стороны';
        }
      });

      svgEl.appendChild(hintGroup);
    }

    // 10. Жест «Разрез пальцем»: если провести пальцем линию через фигуру (начиная с сетки вокруг неё),
    // за пальцем тянется пунктирная линия разреза, которая разделяет фигуру на части!
    if ((figure.parts || []).length > 1) {
      let sliceActive = false;
      let slicePointerId = null;
      let sx1 = 0;
      let sy1 = 0;
      const sliceLineEl = createSvgEl('line', {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        stroke: '#E11D48',
        'stroke-width': '4',
        'stroke-dasharray': '8 6',
        'stroke-linecap': 'round',
        opacity: '0',
        'pointer-events': 'none'
      });
      svgEl.appendChild(sliceLineEl);

      function clientToSvg(clientX, clientY) {
        try {
          if (svgEl.createSVGPoint && svgEl.getScreenCTM) {
            const pt = svgEl.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const ctm = svgEl.getScreenCTM();
            if (ctm) {
              const transformed = pt.matrixTransform(ctm.inverse());
              return [Math.round(transformed.x), Math.round(transformed.y)];
            }
          }
        } catch (err) {}
        const rect = svgEl.getBoundingClientRect();
        const x = rect.width > 0 ? ((clientX - rect.left) * viewW) / rect.width : 0;
        const y = rect.height > 0 ? ((clientY - rect.top) * viewH) / rect.height : 0;
        return [Math.round(x), Math.round(y)];
      }

      svgEl.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        sliceActive = true;
        slicePointerId = e.pointerId;
        const [x, y] = clientToSvg(e.clientX, e.clientY);
        sx1 = x;
        sy1 = y;
        sliceLineEl.setAttribute('x1', x);
        sliceLineEl.setAttribute('y1', y);
        sliceLineEl.setAttribute('x2', x);
        sliceLineEl.setAttribute('y2', y);
        sliceLineEl.setAttribute('opacity', '0.9');
        try {
          svgEl.setPointerCapture(e.pointerId);
        } catch (err) {}
      });

      svgEl.addEventListener('pointermove', (e) => {
        if (!sliceActive || e.pointerId !== slicePointerId) return;
        const [x2, y2] = clientToSvg(e.clientX, e.clientY);
        sliceLineEl.setAttribute('x2', x2);
        sliceLineEl.setAttribute('y2', y2);
      });

      function endSliceGesture(e) {
        if (!sliceActive || (e && e.pointerId !== undefined && e.pointerId !== slicePointerId)) return;
        sliceActive = false;
        sliceLineEl.setAttribute('opacity', '0');
        try {
          if (slicePointerId !== null) svgEl.releasePointerCapture(slicePointerId);
        } catch (err) {}
        slicePointerId = null;

        const [x2, y2] = clientToSvg(e.clientX, e.clientY);
        const len = Math.hypot(x2 - sx1, y2 - sy1);
        if (len > 45) {
          controller.drawSplitLines();
          controller.colorParts();
          controller.separateParts(true);
          const dockSepBtn = document.getElementById('dockSeparateToggleBtn');
          if (dockSepBtn) {
            dockSepBtn.textContent = '↩ Собрать обратно';
          }
        }
      }

      svgEl.addEventListener('pointerup', endSliceGesture);
      svgEl.addEventListener('pointercancel', endSliceGesture);
    }

    // API управления сценой
    const controller = {
      tf,
      outerPoly,
      partControllers,
      splitLineControllers,
      unitCellEls,
      vertexEls,
      dimEls,
      candidateControllers,
      isSeparated: () => separatedState,

      /**
       * Сброс к исходной неразделённой фигуре
       */
      resetToInitial() {
        separatedState = false;
        if (outerPoly) {
          outerPoly.classList.add('visible');
          outerPoly.classList.remove('faded');
        }
        dimsLayer.classList.remove('hidden-on-separate');
        splitLinesLayer.classList.remove('faded-on-separate');

        Object.values(partControllers).forEach((pc) => {
          pc.currentDx = 0;
          pc.currentDy = 0;
          pc.groupEl.classList.add('uncoloured');
          pc.groupEl.classList.remove('colored', 'highlighted', 'dimmed', 'separated-shadow', 'dragging-now');
          pc.groupEl.style.transform = 'translate3d(0px, 0px, 0px)';
          pc.badgeEl.classList.remove('visible');
          if (pc.ownDetailsEl) pc.ownDetailsEl.classList.remove('visible');
          if (pc.heightEl && !options.showHeightsImmediately) {
            pc.heightEl.classList.remove('visible');
          }
        });
        updateDragHintBadge();
        splitLineControllers.forEach((sc) => {
          sc.lineEl.classList.remove('drawing');
          sc.dashedOverlay.classList.remove('visible');
          sc.pStart.setAttribute('opacity', '0');
          sc.pEnd.setAttribute('opacity', '0');
        });
        vertexEls.forEach((v) => {
          v.setAttribute('opacity', '0');
          v.classList.remove('pulsing');
        });
        unitCellEls.forEach((row) =>
          row.forEach((cell) => cell.classList.remove('filled'))
        );
      },

      showKeyVertices(show = true) {
        vertexEls.forEach((v) => {
          v.setAttribute('opacity', show ? '1' : '0');
          if (show) v.classList.add('pulsing');
          else v.classList.remove('pulsing');
        });
      },

      drawSplitLines(index = null) {
        splitLineControllers.forEach((sc, idx) => {
          if (index === null || index === idx) {
            sc.lineEl.classList.remove('drawing');
            void sc.lineEl.getBoundingClientRect();
            sc.lineEl.classList.add('drawing');
            sc.dashedOverlay.classList.add('visible');
            sc.pStart.setAttribute('opacity', '1');
            sc.pEnd.setAttribute('opacity', '1');
          }
        });
      },

      colorParts(partId = null) {
        Object.values(partControllers).forEach((pc) => {
          if (partId === null || pc.part.id === partId) {
            pc.groupEl.classList.remove('uncoloured');
            pc.groupEl.classList.add('colored');
          }
        });
      },

      /**
       * Наглядное разнесение частей в стороны:
       * Каждая простая фигура (прямоугольник, треугольник) уходит в сторону на заметное расстояние,
       * внешние общие размеры скрываются, а у каждой отдельной фигуры появляются её собственные
       * стороны, прямые углы, основание и высота!
       */
      separateParts(showBadges = true) {
        separatedState = true;
        if (outerPoly) {
          outerPoly.classList.add('faded');
        }
        if ((figure.parts || []).length > 1) {
          dimsLayer.classList.add('hidden-on-separate');
          splitLinesLayer.classList.add('faded-on-separate');
        }

        Object.values(partControllers).forEach((pc) => {
          pc.groupEl.classList.remove('uncoloured');
          pc.groupEl.classList.add('colored', 'separated-shadow');
          const [dx, dy] = pc.part.sepOffset || [0, 0];
          pc.currentDx = dx;
          pc.currentDy = dy;
          pc.groupEl.style.transform = `translate3d(${dx}px, ${dy}px, 0px)`;
          if (showBadges) {
            pc.badgeEl.classList.add('visible');
          }
          if (pc.ownDetailsEl && (figure.parts || []).length > 1) {
            pc.ownDetailsEl.classList.add('visible');
          }
          if (pc.heightEl) {
            pc.heightEl.classList.add('visible');
          }
        });
        updateDragHintBadge();
      },

      /**
       * Плавный возврат частей из сторон обратно в единую сложную фигуру
       */
      reassembleParts(keepBadges = true) {
        separatedState = false;
        if (outerPoly) {
          outerPoly.classList.remove('faded');
        }
        dimsLayer.classList.remove('hidden-on-separate');
        splitLinesLayer.classList.remove('faded-on-separate');

        Object.values(partControllers).forEach((pc) => {
          pc.currentDx = 0;
          pc.currentDy = 0;
          pc.groupEl.style.transform = 'translate3d(0px, 0px, 0px)';
          pc.groupEl.classList.remove('highlighted', 'dimmed', 'separated-shadow', 'dragging-now');
          if (pc.ownDetailsEl) {
            pc.ownDetailsEl.classList.remove('visible');
          }
          if (keepBadges) {
            pc.badgeEl.classList.add('visible');
          }
        });
        updateDragHintBadge();
      },

      /**
       * Переключатель «Разнести фигуры в стороны / Собрать обратно»
       */
      toggleSeparate() {
        if (separatedState) {
          controller.reassembleParts(true);
          return false;
        } else {
          controller.drawSplitLines();
          controller.colorParts();
          controller.separateParts(true);
          return true;
        }
      },

      /**
       * Выделение конкретной части фигуры
       */
      highlightPart(partId) {
        Object.values(partControllers).forEach((pc) => {
          pc.groupEl.classList.remove('uncoloured');
          pc.groupEl.classList.add('colored');
          if (pc.part.id === partId) {
            pc.groupEl.classList.add('highlighted');
            pc.groupEl.classList.remove('dimmed');
            pc.badgeEl.classList.add('visible');
            if (pc.heightEl) pc.heightEl.classList.add('visible');
            if (pc.ownDetailsEl && separatedState) pc.ownDetailsEl.classList.add('visible');
          } else {
            pc.groupEl.classList.remove('highlighted');
            pc.groupEl.classList.add('dimmed');
          }
        });
      },

      clearHighlight() {
        Object.values(partControllers).forEach((pc) => {
          pc.groupEl.classList.remove('highlighted', 'dimmed');
        });
      },

      fillUnitRow(rowIndex) {
        if (unitCellEls[rowIndex]) {
          unitCellEls[rowIndex].forEach((cell, cIdx) => {
            setTimeout(() => {
              cell.classList.add('filled');
            }, cIdx * 70);
          });
        }
      },

      fillAllUnitCells() {
        unitCellEls.forEach((row) =>
          row.forEach((cell) => cell.classList.add('filled'))
        );
      }
    };

    return controller;
  }

  /* ========================================================================
     БИБЛИОТЕКА МАТЕМАТИЧЕСКИ ВЫВЕРЕННЫХ ГЕОМЕТРИЧЕСКИХ ФИГУР УРОКА
     С увеличенными векторами разнесения в стороны (sepOffset), чтобы детям
     было отчётливо видно каждую отдельную простую фигуру!
     ======================================================================== */

  const FIGURES = {
    /* ----------------------------------------------------------------------
       УРОВЕНЬ 1: ПРЯМОУГОЛЬНИК 6 × 4 И ТРЕУГОЛЬНИК 8 × 4
       ---------------------------------------------------------------------- */
    L1_RECT: {
      id: 'L1_RECT',
      title: 'Прямоугольник 6 см × 4 см',
      outerContour: [[0, 0], [6, 0], [6, 4], [0, 4]],
      unitCells: { cols: 6, rows: 4, startX: 0, startY: 0 },
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник',
          shortLabel: 'Прямоугольник',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S = a × b',
          calcText: 'S = 6 × 4 = 24 см²',
          area: 24,
          points: [[0, 0], [6, 0], [6, 4], [0, 4]],
          sepOffset: [0, 0],
          rightAngle: { x: 0, y: 4, dirX: 1, dirY: -1 }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 6, y2: 0, offsetPx: -26, text: 'a = 6 см', color: '#2563EB' },
        { x1: 0, y1: 4, x2: 0, y2: 0, offsetPx: -34, text: 'b = 4 см', color: '#2563EB' }
      ]
    },

    L1_TRI: {
      id: 'L1_TRI',
      title: 'Треугольник: основание 8 см, высота 4 см',
      outerContour: [[0, 0], [8, 0], [8, 4], [0, 4]],
      splitLines: [
        { x1: 0, y1: 0, x2: 8, y2: 4 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'tri1',
          name: 'Основной треугольник',
          shortLabel: 'Треугольник 1',
          dimSummary: '(8 × 4) : 2 = 16 см²',
          formula: 'S = (a × h) : 2',
          calcText: 'S = (8 × 4) : 2 = 16 см²',
          area: 16,
          points: [[0, 0], [8, 4], [0, 4]],
          sepOffset: [-58, 26],
          badgeDx: -40,
          badgeDy: 24,
          heightLine: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 4,
            rightAngle: { x: 0, y: 4, dirX: 1, dirY: -1 },
            label: 'h = 4 см',
            labelDx: 44,
            labelDy: 0
          }
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Второй равный треугольник',
          shortLabel: 'Треугольник 2 (равный)',
          dimSummary: 'Половина пр-ка (16 см²)',
          formula: 'S = (a × h) : 2',
          calcText: 'S₂ = (8 × 4) : 2 = 16 см²',
          area: 16,
          points: [[0, 0], [8, 0], [8, 4]],
          sepOffset: [58, -26],
          badgeDx: 42,
          badgeDy: -24
        }
      ],
      dimensions: [
        { x1: 0, y1: 4, x2: 8, y2: 4, offsetPx: 28, text: 'Основание a = 8 см', color: '#059669' },
        { x1: 0, y1: 4, x2: 0, y2: 0, offsetPx: -38, text: 'Высота h = 4 см', color: '#0284C7' }
      ]
    },

    /* ----------------------------------------------------------------------
       УРОВЕНЬ 2: СЛОЖНАЯ L-ОБРАЗНАЯ ФИГУРА ИЗ ДВУХ ПРЯМОУГОЛЬНИКОВ
       Части при разделении расходятся влево-вверх и вправо-вниз, чтобы
       каждый прямоугольник стоял отдельно со своими размерами!
       ---------------------------------------------------------------------- */
    L2_MAIN: {
      id: 'L2_MAIN',
      title: 'L-образная фигура из двух прямоугольников',
      outerContour: [[0, 0], [8, 0], [8, 3], [4, 3], [4, 5], [0, 5]],
      keyVertices: [[0, 3], [4, 3]],
      splitLines: [
        { x1: 0, y1: 3, x2: 4, y2: 3 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник 1 (верхний)',
          shortLabel: 'Прямоугольник 1 (8 × 3)',
          dimSummary: 'S₁ = 24 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 8 × 3 = 24 см²',
          area: 24,
          points: [[0, 0], [8, 0], [8, 3], [0, 3]],
          sepOffset: [-48, -32]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Прямоугольник 2 (нижний)',
          shortLabel: 'Прямоугольник 2 (4 × 2)',
          dimSummary: 'S₂ = 8 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 4 × 2 = 8 см²',
          area: 8,
          points: [[0, 3], [4, 3], [4, 5], [0, 5]],
          sepOffset: [78, 34]
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 8, y2: 0, offsetPx: -26, text: '8 см', color: '#2563EB' },
        { x1: 8, y1: 0, x2: 8, y2: 3, offsetPx: -28, text: '3 см', color: '#2563EB' },
        { x1: 0, y1: 5, x2: 4, y2: 5, offsetPx: 26, text: '4 см', color: '#4F46E5' },
        { x1: 4, y1: 3, x2: 4, y2: 5, offsetPx: -28, text: '2 см', color: '#4F46E5' },
        { x1: 0, y1: 5, x2: 0, y2: 0, offsetPx: -34, text: '5 см', color: '#475569' }
      ]
    },

    /* ----------------------------------------------------------------------
       УРОВЕНЬ 3: ФИГУРА ИЗ ПРЯМОУГОЛЬНИКА (6 × 4) И ТРЕУГОЛЬНИКА (a = 4, h = 6)
       При разделении прямоугольник уходит далеко влево (-72px), а треугольник
       далеко вправо (+72px), образуя расстояние 144px между ними!
       ---------------------------------------------------------------------- */
    L3_MAIN: {
      id: 'L3_MAIN',
      title: 'Фигура из прямоугольника и треугольника',
      outerContour: [[0, 0], [4, 0], [8, 6], [0, 6]],
      keyVertices: [[4, 0], [4, 6]],
      splitLines: [
        { x1: 4, y1: 0, x2: 4, y2: 6 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник (6 см × 4 см)',
          shortLabel: 'Прямоугольник',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[0, 0], [4, 0], [4, 6], [0, 6]],
          sepOffset: [-72, 0],
          rightAngle: { x: 0, y: 6, dirX: 1, dirY: -1 }
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Треугольник (a = 4 см, h = 6 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(4 × 6) : 2 = 12 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (4 × 6) : 2 = 12 см²',
          area: 12,
          points: [[4, 0], [8, 6], [4, 6]],
          sepOffset: [72, 0],
          badgeDx: 10,
          badgeDy: 46,
          heightLine: {
            x1: 4,
            y1: 0,
            x2: 4,
            y2: 6,
            rightAngle: { x: 4, y: 6, dirX: 1, dirY: -1 },
            label: 'h = 6 см',
            labelDx: 38,
            labelDy: -25
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 4, y2: 0, offsetPx: -26, text: '4 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 4, y2: 6, offsetPx: 28, text: '4 см', color: '#2563EB' },
        { x1: 4, y1: 6, x2: 8, y2: 6, offsetPx: 28, text: 'a = 4 см', color: '#059669' }
      ]
    },

    /* ----------------------------------------------------------------------
       УРОВЕНЬ 4: ФИГУРЫ ИЗ ТРЁХ И БОЛЕЕ ЧАСТЕЙ (4 РАЗЛИЧНЫХ ПРИМЕРА)
       Каждая часть расходится в свою сторону на 55–80 пикселей!
       ---------------------------------------------------------------------- */
    L4_EX1: {
      id: 'L4_EX1',
      title: 'Два прямоугольника и один треугольник',
      outerContour: [[0, 0], [4, 0], [4, 3], [6, 3], [9, 7], [0, 7]],
      keyVertices: [[0, 3], [4, 3], [6, 3], [6, 7]],
      splitLines: [
        { x1: 0, y1: 3, x2: 4, y2: 3 },
        { x1: 6, y1: 3, x2: 6, y2: 7 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник 1 (6 × 4 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[0, 3], [6, 3], [6, 7], [0, 7]],
          sepOffset: [-42, 30]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Прямоугольник 2 (3 × 4 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '3 × 4 = 12 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 3 × 4 = 12 см²',
          area: 12,
          points: [[0, 0], [4, 0], [4, 3], [0, 3]],
          sepOffset: [-62, -34]
        },
        {
          id: 'p3',
          type: 'tri1',
          name: 'Треугольник (a = 4 см, h = 3 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(4 × 3) : 2 = 6 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (4 × 3) : 2 = 6 см²',
          area: 6,
          points: [[6, 3], [9, 7], [6, 7]],
          sepOffset: [76, 26],
          badgeDx: 14,
          badgeDy: 30,
          heightLine: {
            x1: 6,
            y1: 3,
            x2: 6,
            y2: 7,
            rightAngle: { x: 6, y: 7, dirX: 1, dirY: -1 },
            label: 'a = 4 см',
            labelDx: -34,
            labelDy: -22
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 4, y2: 0, offsetPx: -24, text: '4 см', color: '#4F46E5' },
        { x1: 0, y1: 3, x2: 0, y2: 0, offsetPx: -34, text: '3 см', color: '#4F46E5' },
        { x1: 0, y1: 7, x2: 0, y2: 3, offsetPx: -34, text: '4 см', color: '#2563EB' },
        { x1: 4, y1: 3, x2: 6, y2: 3, offsetPx: -24, text: '2 см', color: '#2563EB' },
        { x1: 0, y1: 7, x2: 6, y2: 7, offsetPx: 28, text: '6 см', color: '#2563EB' },
        { x1: 6, y1: 7, x2: 9, y2: 7, offsetPx: 28, text: 'h = 3 см', color: '#059669' }
      ]
    },

    L4_EX2: {
      id: 'L4_EX2',
      title: 'Один прямоугольник и два треугольника',
      outerContour: [[3, 0], [9, 0], [12, 4], [0, 4]],
      keyVertices: [[3, 0], [3, 4], [9, 0], [9, 4]],
      splitLines: [
        { x1: 3, y1: 0, x2: 3, y2: 4 },
        { x1: 9, y1: 0, x2: 9, y2: 4 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Центральный прямоугольник (6 × 4 см)',
          shortLabel: 'Прямоугольник',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[3, 0], [9, 0], [9, 4], [3, 4]],
          sepOffset: [0, -24]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Левый треугольник (a = 3 см, h = 4 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(3 × 4) : 2 = 6 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (3 × 4) : 2 = 6 см²',
          area: 6,
          points: [[0, 4], [3, 0], [3, 4]],
          sepOffset: [-76, 22],
          badgeDx: -12,
          badgeDy: 28,
          heightLine: {
            x1: 3,
            y1: 0,
            x2: 3,
            y2: 4,
            rightAngle: { x: 3, y: 4, dirX: -1, dirY: -1 }
          }
        },
        {
          id: 'p3',
          type: 'tri2',
          name: 'Правый треугольник (a = 3 см, h = 4 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(3 × 4) : 2 = 6 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (3 × 4) : 2 = 6 см²',
          area: 6,
          points: [[9, 0], [12, 4], [9, 4]],
          sepOffset: [76, 22],
          badgeDx: 12,
          badgeDy: 28,
          heightLine: {
            x1: 9,
            y1: 0,
            x2: 9,
            y2: 4,
            rightAngle: { x: 9, y: 4, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 3, y1: 0, x2: 9, y2: 0, offsetPx: -26, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 4, x2: 3, y2: 4, offsetPx: 28, text: '3 см', color: '#059669' },
        { x1: 3, y1: 4, x2: 9, y2: 4, offsetPx: 28, text: '6 см', color: '#2563EB' },
        { x1: 9, y1: 4, x2: 12, y2: 4, offsetPx: 28, text: '3 см', color: '#D97706' },
        { x1: 3, y1: 0, x2: 3, y2: 4, offsetPx: 30, text: 'h = 4 см', color: '#0284C7' }
      ]
    },

    L4_EX3: {
      id: 'L4_EX3',
      title: 'Фигура из трёх прямоугольников (Пьедестал)',
      outerContour: [[0, 2], [3, 2], [3, 0], [7, 0], [7, 3], [10, 3], [10, 5], [0, 5]],
      keyVertices: [[3, 2], [3, 5], [7, 3], [7, 5]],
      splitLines: [
        { x1: 3, y1: 2, x2: 3, y2: 5 },
        { x1: 7, y1: 3, x2: 7, y2: 5 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Левый прямоугольник (3 × 3 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '3 × 3 = 9 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 3 × 3 = 9 см²',
          area: 9,
          points: [[0, 2], [3, 2], [3, 5], [0, 5]],
          sepOffset: [-74, 18]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Центральный прямоугольник (4 × 5 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '4 × 5 = 20 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 4 × 5 = 20 см²',
          area: 20,
          points: [[3, 0], [7, 0], [7, 5], [3, 5]],
          sepOffset: [0, -24]
        },
        {
          id: 'p3',
          type: 'rect3',
          name: 'Правый прямоугольник (3 × 2 см)',
          shortLabel: 'Прямоугольник 3',
          dimSummary: '3 × 2 = 6 см²',
          formula: 'S₃ = a₃ × b₃',
          calcText: 'S₃ = 3 × 2 = 6 см²',
          area: 6,
          points: [[7, 3], [10, 3], [10, 5], [7, 5]],
          sepOffset: [74, 18]
        }
      ],
      dimensions: [
        { x1: 0, y1: 2, x2: 3, y2: 2, offsetPx: -24, text: '3 см', color: '#2563EB' },
        { x1: 0, y1: 5, x2: 0, y2: 2, offsetPx: -32, text: '3 см', color: '#2563EB' },
        { x1: 3, y1: 0, x2: 7, y2: 0, offsetPx: -24, text: '4 см', color: '#4F46E5' },
        { x1: 7, y1: 0, x2: 7, y2: 3, offsetPx: -28, text: '3 см', color: '#4F46E5' },
        { x1: 7, y1: 3, x2: 10, y2: 3, offsetPx: -24, text: '3 см', color: '#7C3AED' },
        { x1: 10, y1: 3, x2: 10, y2: 5, offsetPx: -28, text: '2 см', color: '#7C3AED' }
      ]
    },

    L4_EX4: {
      id: 'L4_EX4',
      title: 'Два прямоугольника и два треугольника',
      outerContour: [[0, 2], [3, 2], [3, 0], [7, 0], [7, 2], [10, 2], [8, 5], [2, 5]],
      keyVertices: [[2, 2], [2, 5], [3, 2], [7, 2], [8, 2], [8, 5]],
      splitLines: [
        { x1: 3, y1: 2, x2: 7, y2: 2 },
        { x1: 2, y1: 2, x2: 2, y2: 5 },
        { x1: 8, y1: 2, x2: 8, y2: 5 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Основной прямоугольник (6 × 3 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '6 × 3 = 18 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 6 × 3 = 18 см²',
          area: 18,
          points: [[2, 2], [8, 2], [8, 5], [2, 5]],
          sepOffset: [0, 32]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Верхний прямоугольник (4 × 2 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '4 × 2 = 8 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 4 × 2 = 8 см²',
          area: 8,
          points: [[3, 0], [7, 0], [7, 2], [3, 2]],
          sepOffset: [0, -38]
        },
        {
          id: 'p3',
          type: 'tri1',
          name: 'Левый треугольник (a = 2 см, h = 3 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(2 × 3) : 2 = 3 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (2 × 3) : 2 = 3 см²',
          area: 3,
          points: [[0, 2], [2, 2], [2, 5]],
          sepOffset: [-78, 28],
          badgeDx: -18,
          badgeDy: 24,
          heightLine: {
            x1: 2,
            y1: 2,
            x2: 2,
            y2: 5,
            rightAngle: { x: 2, y: 2, dirX: -1, dirY: 1 }
          }
        },
        {
          id: 'p4',
          type: 'tri2',
          name: 'Правый треугольник (a = 2 см, h = 3 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(2 × 3) : 2 = 3 см²',
          formula: 'S₄ = (a × h) : 2',
          calcText: 'S₄ = (2 × 3) : 2 = 3 см²',
          area: 3,
          points: [[8, 2], [10, 2], [8, 5]],
          sepOffset: [78, 28],
          badgeDx: 18,
          badgeDy: 24,
          heightLine: {
            x1: 8,
            y1: 2,
            x2: 8,
            y2: 5,
            rightAngle: { x: 8, y: 2, dirX: 1, dirY: 1 }
          }
        }
      ],
      dimensions: [
        { x1: 3, y1: 0, x2: 7, y2: 0, offsetPx: -24, text: '4 см', color: '#4F46E5' },
        { x1: 7, y1: 0, x2: 7, y2: 2, offsetPx: -26, text: '2 см', color: '#4F46E5' },
        { x1: 0, y1: 2, x2: 2, y2: 2, offsetPx: -24, text: '2 см', color: '#059669' },
        { x1: 8, y1: 2, x2: 10, y2: 2, offsetPx: -24, text: '2 см', color: '#D97706' },
        { x1: 2, y1: 5, x2: 8, y2: 5, offsetPx: 28, text: '6 см', color: '#2563EB' },
        { x1: 8, y1: 2, x2: 8, y2: 5, offsetPx: -28, text: '3 см', color: '#2563EB' }
      ]
    },

    /* ----------------------------------------------------------------------
       УРОВЕНЬ 5: САМОСТОЯТЕЛЬНЫЙ РАЗБОР СЛОЖНЫХ ФИГУР И ДВА СПОСОБА РЕШЕНИЯ
       ---------------------------------------------------------------------- */
    L5_SLANT_WAY1: {
      id: 'L5_SLANT_WAY1',
      title: 'Фигура с наклонной стороной — Способ №1 (2 прямоугольника и 1 треугольник)',
      outerContour: [[0, 0], [6, 0], [10, 4], [10, 6], [0, 6]],
      keyVertices: [[6, 0], [6, 6], [6, 4], [10, 4]],
      splitLines: [
        { x1: 6, y1: 0, x2: 6, y2: 6 },
        { x1: 6, y1: 4, x2: 10, y2: 4 }
      ],
      candidateCuts: [
        {
          id: 'cut_valid_way1',
          x1: 6,
          y1: 0,
          x2: 6,
          y2: 6,
          valid: true,
          way: 1,
          feedback: 'Отлично! Вертикальная линия отделяет большой прямоугольник 6 × 6 см, а правая часть делится на прямоугольник 4 × 2 см и треугольник 4 × 4 см.'
        },
        {
          id: 'cut_invalid_diag',
          x1: 0,
          y1: 0,
          x2: 10,
          y2: 4,
          valid: false,
          feedback: 'Эта наклонная линия не параллельна сторонам сетки — по ней неудобно искать стороны прямоугольников. Выбери линию из вершины (6, 0) вертикально вниз!'
        }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник 1 (6 × 6 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '6 × 6 = 36 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 6 × 6 = 36 см²',
          area: 36,
          points: [[0, 0], [6, 0], [6, 6], [0, 6]],
          sepOffset: [-62, 0]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Прямоугольник 2 (4 × 2 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '4 × 2 = 8 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 4 × 2 = 8 см²',
          area: 8,
          points: [[6, 4], [10, 4], [10, 6], [6, 6]],
          sepOffset: [68, 32]
        },
        {
          id: 'p3',
          type: 'tri1',
          name: 'Треугольник (a = 4 см, h = 4 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(4 × 4) : 2 = 8 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (4 × 4) : 2 = 8 см²',
          area: 8,
          points: [[6, 0], [10, 4], [6, 4]],
          sepOffset: [68, -32],
          heightLine: {
            x1: 6,
            y1: 0,
            x2: 6,
            y2: 4,
            rightAngle: { x: 6, y: 4, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 6, y2: 0, offsetPx: -26, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 10, y2: 6, offsetPx: 28, text: '10 см (6 + 4)', color: '#1E293B' },
        { x1: 10, y1: 4, x2: 10, y2: 6, offsetPx: -30, text: '2 см', color: '#4F46E5' }
      ]
    },

    L5_SLANT_WAY2: {
      id: 'L5_SLANT_WAY2',
      title: 'Фигура с наклонной стороной — Способ №2 (1 прямоугольник и 2 треугольника)',
      outerContour: [[0, 0], [6, 0], [10, 4], [10, 6], [0, 6]],
      keyVertices: [[6, 0], [6, 6], [10, 4]],
      splitLines: [
        { x1: 6, y1: 0, x2: 6, y2: 6 },
        { x1: 6, y1: 6, x2: 10, y2: 4 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Прямоугольник (6 × 6 см)',
          shortLabel: 'Прямоугольник',
          dimSummary: '6 × 6 = 36 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 6 × 6 = 36 см²',
          area: 36,
          points: [[0, 0], [6, 0], [6, 6], [0, 6]],
          sepOffset: [-62, 0]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Треугольник 1 (основание 6 см, высота 4 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(6 × 4) : 2 = 12 см²',
          formula: 'S₂ = (a₁ × h₁) : 2',
          calcText: 'S₂ = (6 × 4) : 2 = 12 см²',
          area: 12,
          points: [[6, 0], [10, 4], [6, 6]],
          sepOffset: [62, -28],
          badgeDx: 8,
          badgeDy: -12,
          heightLine: {
            x1: 6,
            y1: 4,
            x2: 10,
            y2: 4,
            rightAngle: { x: 6, y: 4, dirX: 1, dirY: -1 }
          }
        },
        {
          id: 'p3',
          type: 'tri2',
          name: 'Треугольник 2 (основание 4 см, высота 2 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(4 × 2) : 2 = 4 см²',
          formula: 'S₃ = (a₂ × h₂) : 2',
          calcText: 'S₃ = (4 × 2) : 2 = 4 см²',
          area: 4,
          points: [[6, 6], [10, 4], [10, 6]],
          sepOffset: [74, 34],
          badgeDx: 18,
          badgeDy: 24,
          heightLine: {
            x1: 10,
            y1: 4,
            x2: 10,
            y2: 6,
            rightAngle: { x: 10, y: 6, dirX: -1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 6, y2: 0, offsetPx: -26, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 10, y2: 6, offsetPx: 28, text: '10 см (6 + 4)', color: '#1E293B' },
        { x1: 10, y1: 4, x2: 10, y2: 6, offsetPx: -30, text: '2 см', color: '#D97706' }
      ]
    },

    L5_HOUSE_WAY1: {
      id: 'L5_HOUSE_WAY1',
      title: 'Фигура «Домик» — Способ №1 (Прямоугольник и треугольник крыши)',
      outerContour: [[4, 0], [8, 3], [8, 7], [0, 7], [0, 3]],
      keyVertices: [[0, 3], [8, 3]],
      splitLines: [
        { x1: 0, y1: 3, x2: 8, y2: 3 }
      ],
      candidateCuts: [
        {
          id: 'cut_house_horiz',
          x1: 0,
          y1: 3,
          x2: 8,
          y2: 3,
          valid: true,
          feedback: 'Верно! Горизонтальная линия отделяет треугольную крышу (основание 8 см, высота 3 см) от прямоугольного фасада (8 × 4 см).'
        },
        {
          id: 'cut_house_wrong',
          x1: 0,
          y1: 5,
          x2: 8,
          y2: 5,
          valid: false,
          feedback: 'Если провести линию здесь, верхняя часть всё ещё останется сложной пятиугольной фигурой. Проведи линию по основанию крыши!'
        }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Стены дома (8 × 4 см)',
          shortLabel: 'Прямоугольник (8 × 4)',
          dimSummary: 'S₁ = 32 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 8 × 4 = 32 см²',
          area: 32,
          points: [[0, 3], [8, 3], [8, 7], [0, 7]],
          sepOffset: [-56, 26]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Крыша дома (a = 8 см, h = 3 см)',
          shortLabel: 'Треугольник (8 × 3 : 2)',
          dimSummary: 'S₂ = 12 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (8 × 3) : 2 = 12 см²',
          area: 12,
          points: [[0, 3], [4, 0], [8, 3]],
          sepOffset: [56, -28],
          badgeDx: 0,
          badgeDy: -22,
          heightLine: {
            x1: 4,
            y1: 0,
            x2: 4,
            y2: 3,
            rightAngle: { x: 4, y: 3, dirX: 1, dirY: -1 },
            label: 'h = 3 см',
            labelDx: 44,
            labelDy: 0
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 7, x2: 8, y2: 7, offsetPx: 28, text: '8 см', color: '#2563EB' },
        { x1: 0, y1: 7, x2: 0, y2: 3, offsetPx: -34, text: '4 см', color: '#2563EB' },
        { x1: 8, y1: 0, x2: 8, y2: 3, offsetPx: -34, text: 'h крыши = 3 см', color: '#0284C7' }
      ]
    },

    L5_HOUSE_WAY2: {
      id: 'L5_HOUSE_WAY2',
      title: 'Фигура «Домик» — Способ №2 (Прямоугольник и два прямоугольных треугольника)',
      outerContour: [[4, 0], [8, 3], [8, 7], [0, 7], [0, 3]],
      keyVertices: [[0, 3], [8, 3], [4, 0], [4, 3]],
      splitLines: [
        { x1: 0, y1: 3, x2: 8, y2: 3 },
        { x1: 4, y1: 0, x2: 4, y2: 3 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Стены дома (8 × 4 см)',
          shortLabel: 'Прямоугольник (8 × 4)',
          dimSummary: 'S₁ = 32 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 8 × 4 = 32 см²',
          area: 32,
          points: [[0, 3], [8, 3], [8, 7], [0, 7]],
          sepOffset: [0, 28]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Левая половина крыши (a = 4 см, h = 3 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(4 × 3) : 2 = 6 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (4 × 3) : 2 = 6 см²',
          area: 6,
          points: [[0, 3], [4, 0], [4, 3]],
          sepOffset: [-66, -28],
          badgeDx: -20,
          badgeDy: -18,
          heightLine: {
            x1: 4,
            y1: 0,
            x2: 4,
            y2: 3,
            rightAngle: { x: 4, y: 3, dirX: -1, dirY: -1 }
          }
        },
        {
          id: 'p3',
          type: 'tri2',
          name: 'Правая половина крыши (a = 4 см, h = 3 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(4 × 3) : 2 = 6 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (4 × 3) : 2 = 6 см²',
          area: 6,
          points: [[4, 0], [8, 3], [4, 3]],
          sepOffset: [66, -28],
          badgeDx: 20,
          badgeDy: -18,
          heightLine: {
            x1: 4,
            y1: 0,
            x2: 4,
            y2: 3,
            rightAngle: { x: 4, y: 3, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 7, x2: 8, y2: 7, offsetPx: 28, text: '8 см (4 + 4)', color: '#2563EB' },
        { x1: 0, y1: 7, x2: 0, y2: 3, offsetPx: -34, text: '4 см', color: '#2563EB' },
        { x1: 8, y1: 0, x2: 8, y2: 3, offsetPx: -34, text: 'h = 3 см', color: '#0284C7' }
      ]
    },

    L5_STEP_WAY1: {
      id: 'L5_STEP_WAY1',
      title: 'Ступенчатая фигура — Способ №1 (Горизонтальное разделение)',
      outerContour: [[0, 0], [4, 0], [4, 3], [9, 3], [9, 6], [0, 6]],
      keyVertices: [[0, 3], [4, 3]],
      splitLines: [
        { x1: 0, y1: 3, x2: 4, y2: 3 }
      ],
      candidateCuts: [
        {
          id: 'cut_step_h',
          x1: 0,
          y1: 3,
          x2: 4,
          y2: 3,
          valid: true,
          way: 1,
          feedback: 'Отлично! Горизонтальный разрез делит фигуру на верхний прямоугольник 4 × 3 см (12 см²) и нижний 9 × 3 см (27 см²).'
        },
        {
          id: 'cut_step_v',
          x1: 4,
          y1: 3,
          x2: 4,
          y2: 6,
          valid: true,
          way: 2,
          feedback: 'Отлично! Вертикальный разрез делит фигуру на левый прямоугольник 4 × 6 см (24 см²) и правый 5 × 3 см (15 см²).'
        }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Верхний прямоугольник (4 × 3 см)',
          shortLabel: 'Прямоугольник 1 (4 × 3)',
          dimSummary: 'S₁ = 12 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 4 × 3 = 12 см²',
          area: 12,
          points: [[0, 0], [4, 0], [4, 3], [0, 3]],
          sepOffset: [-52, -32]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Нижний прямоугольник (9 × 3 см)',
          shortLabel: 'Прямоугольник 2 (9 × 3)',
          dimSummary: 'S₂ = 27 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 9 × 3 = 27 см²',
          area: 27,
          points: [[0, 3], [9, 3], [9, 6], [0, 6]],
          sepOffset: [42, 32]
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 4, y2: 0, offsetPx: -24, text: '4 см', color: '#2563EB' },
        { x1: 4, y1: 0, x2: 4, y2: 3, offsetPx: -26, text: '3 см', color: '#2563EB' },
        { x1: 4, y1: 3, x2: 9, y2: 3, offsetPx: -24, text: '5 см', color: '#4F46E5' },
        { x1: 9, y1: 3, x2: 9, y2: 6, offsetPx: -26, text: '3 см', color: '#4F46E5' },
        { x1: 0, y1: 6, x2: 9, y2: 6, offsetPx: 28, text: '9 см', color: '#1E293B' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#1E293B' }
      ]
    },

    L5_STEP_WAY2: {
      id: 'L5_STEP_WAY2',
      title: 'Ступенчатая фигура — Способ №2 (Вертикальное разделение)',
      outerContour: [[0, 0], [4, 0], [4, 3], [9, 3], [9, 6], [0, 6]],
      keyVertices: [[4, 3], [4, 6]],
      splitLines: [
        { x1: 4, y1: 3, x2: 4, y2: 6 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Левый прямоугольник (4 × 6 см)',
          shortLabel: 'Прямоугольник 1 (4 × 6)',
          dimSummary: 'S₁ = 24 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 4 × 6 = 24 см²',
          area: 24,
          points: [[0, 0], [4, 0], [4, 6], [0, 6]],
          sepOffset: [-68, 0]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Правый прямоугольник (5 × 3 см)',
          shortLabel: 'Прямоугольник 2 (5 × 3)',
          dimSummary: 'S₂ = 15 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 5 × 3 = 15 см²',
          area: 15,
          points: [[4, 3], [9, 3], [9, 6], [4, 6]],
          sepOffset: [68, 0]
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 4, y2: 0, offsetPx: -24, text: '4 см', color: '#2563EB' },
        { x1: 4, y1: 0, x2: 4, y2: 3, offsetPx: -26, text: '3 см', color: '#2563EB' },
        { x1: 4, y1: 3, x2: 9, y2: 3, offsetPx: -24, text: '5 см', color: '#4F46E5' },
        { x1: 9, y1: 3, x2: 9, y2: 6, offsetPx: -26, text: '3 см', color: '#4F46E5' },
        { x1: 0, y1: 6, x2: 9, y2: 6, offsetPx: 28, text: '9 см', color: '#1E293B' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#1E293B' }
      ]
    },

    /* ----------------------------------------------------------------------
       УРОВЕНЬ 6: 6 СЛОЖНЫХ ЗАДАЧ ДЛЯ САМОСТОЯТЕЛЬНОЙ РАБОТЫ
       ---------------------------------------------------------------------- */
    L6_TASK1: {
      id: 'L6_TASK1',
      title: 'Задача 1. Дом с пристройкой',
      outerContour: [[3, 0], [6, 3], [6, 4], [10, 4], [10, 7], [0, 7], [0, 3]],
      splitLines: [
        { x1: 0, y1: 3, x2: 6, y2: 3 },
        { x1: 6, y1: 4, x2: 6, y2: 7 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Стены дома (6 × 4 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[0, 3], [6, 3], [6, 7], [0, 7]],
          sepOffset: [-52, 26]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Крыша (a = 6 см, h = 3 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(6 × 3) : 2 = 9 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (6 × 3) : 2 = 9 см²',
          area: 9,
          points: [[0, 3], [3, 0], [6, 3]],
          sepOffset: [-52, -32],
          heightLine: {
            x1: 3,
            y1: 0,
            x2: 3,
            y2: 3,
            rightAngle: { x: 3, y: 3, dirX: 1, dirY: -1 },
            label: 'h = 3 см',
            labelDx: 38,
            labelDy: 0
          }
        },
        {
          id: 'p3',
          type: 'rect2',
          name: 'Пристройка (4 × 3 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '4 × 3 = 12 см²',
          formula: 'S₃ = a₃ × b₃',
          calcText: 'S₃ = 4 × 3 = 12 см²',
          area: 12,
          points: [[6, 4], [10, 4], [10, 7], [6, 7]],
          sepOffset: [68, 26]
        }
      ],
      dimensions: [
        { x1: 0, y1: 7, x2: 6, y2: 7, offsetPx: 28, text: '6 см', color: '#2563EB' },
        { x1: 6, y1: 7, x2: 10, y2: 7, offsetPx: 28, text: '4 см', color: '#4F46E5' },
        { x1: 0, y1: 7, x2: 0, y2: 3, offsetPx: -34, text: '4 см', color: '#2563EB' },
        { x1: 10, y1: 4, x2: 10, y2: 7, offsetPx: -28, text: '3 см', color: '#4F46E5' }
      ]
    },

    L6_TASK2: {
      id: 'L6_TASK2',
      title: 'Задача 2. Трапециевидная насыпь',
      outerContour: [[2, 0], [7, 0], [11, 4], [0, 4]],
      splitLines: [
        { x1: 2, y1: 0, x2: 2, y2: 4 },
        { x1: 7, y1: 0, x2: 7, y2: 4 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Центральный прямоугольник (5 × 4 см)',
          shortLabel: 'Прямоугольник',
          dimSummary: '5 × 4 = 20 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 5 × 4 = 20 см²',
          area: 20,
          points: [[2, 0], [7, 0], [7, 4], [2, 4]],
          sepOffset: [0, -24]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Левый склон (a = 2 см, h = 4 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(2 × 4) : 2 = 4 см²',
          formula: 'S₂ = (a₁ × h) : 2',
          calcText: 'S₂ = (2 × 4) : 2 = 4 см²',
          area: 4,
          points: [[0, 4], [2, 0], [2, 4]],
          sepOffset: [-78, 22],
          badgeDx: -14,
          badgeDy: 28,
          heightLine: {
            x1: 2,
            y1: 0,
            x2: 2,
            y2: 4,
            rightAngle: { x: 2, y: 4, dirX: -1, dirY: -1 }
          }
        },
        {
          id: 'p3',
          type: 'tri2',
          name: 'Правый склон (a = 4 см, h = 4 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(4 × 4) : 2 = 8 см²',
          formula: 'S₃ = (a₂ × h) : 2',
          calcText: 'S₃ = (4 × 4) : 2 = 8 см²',
          area: 8,
          points: [[7, 0], [11, 4], [7, 4]],
          sepOffset: [78, 22],
          badgeDx: 14,
          badgeDy: 28,
          heightLine: {
            x1: 7,
            y1: 0,
            x2: 7,
            y2: 4,
            rightAngle: { x: 7, y: 4, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 2, y1: 0, x2: 7, y2: 0, offsetPx: -26, text: '5 см', color: '#2563EB' },
        { x1: 0, y1: 4, x2: 2, y2: 4, offsetPx: 28, text: '2 см', color: '#059669' },
        { x1: 2, y1: 4, x2: 7, y2: 4, offsetPx: 28, text: '5 см', color: '#2563EB' },
        { x1: 7, y1: 4, x2: 11, y2: 4, offsetPx: 28, text: '4 см', color: '#D97706' },
        { x1: 2, y1: 0, x2: 2, y2: 4, offsetPx: 30, text: 'h = 4 см', color: '#0284C7' }
      ]
    },

    L6_TASK3: {
      id: 'L6_TASK3',
      title: 'Задача 3. Трёхступенчатая лестница',
      outerContour: [[0, 0], [3, 0], [3, 2], [6, 2], [6, 4], [9, 4], [9, 6], [0, 6]],
      splitLines: [
        { x1: 3, y1: 2, x2: 3, y2: 6 },
        { x1: 6, y1: 4, x2: 6, y2: 6 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Высокая ступень (3 × 6 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '3 × 6 = 18 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 3 × 6 = 18 см²',
          area: 18,
          points: [[0, 0], [3, 0], [3, 6], [0, 6]],
          sepOffset: [-74, -14]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Средняя ступень (3 × 4 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '3 × 4 = 12 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 3 × 4 = 12 см²',
          area: 12,
          points: [[3, 2], [6, 2], [6, 6], [3, 6]],
          sepOffset: [0, 26]
        },
        {
          id: 'p3',
          type: 'rect3',
          name: 'Нижняя ступень (3 × 2 см)',
          shortLabel: 'Прямоугольник 3',
          dimSummary: '3 × 2 = 6 см²',
          formula: 'S₃ = a₃ × b₃',
          calcText: 'S₃ = 3 × 2 = 6 см²',
          area: 6,
          points: [[6, 4], [9, 4], [9, 6], [6, 6]],
          sepOffset: [74, -14]
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 3, y2: 0, offsetPx: -24, text: '3 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#2563EB' },
        { x1: 3, y1: 2, x2: 6, y2: 2, offsetPx: -24, text: '3 см', color: '#4F46E5' },
        { x1: 6, y1: 4, x2: 9, y2: 4, offsetPx: -24, text: '3 см', color: '#7C3AED' },
        { x1: 3, y1: 0, x2: 3, y2: 2, offsetPx: -26, text: '2 см', color: '#475569' },
        { x1: 9, y1: 4, x2: 9, y2: 6, offsetPx: -26, text: '2 см', color: '#7C3AED' }
      ]
    },

    L6_TASK4: {
      id: 'L6_TASK4',
      title: 'Задача 4. Дорожный указатель «Стрела»',
      outerContour: [[0, 2], [6, 2], [6, 0], [10, 4], [6, 8], [6, 6], [0, 6]],
      splitLines: [
        { x1: 6, y1: 2, x2: 6, y2: 6 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Основание стрелы (6 × 4 см)',
          shortLabel: 'Прямоугольник',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a × b',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[0, 2], [6, 2], [6, 6], [0, 6]],
          sepOffset: [-72, 0]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: 'Наконечник стрелы (a = 8 см, h = 4 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(8 × 4) : 2 = 16 см²',
          formula: 'S₂ = (a × h) : 2',
          calcText: 'S₂ = (8 × 4) : 2 = 16 см²',
          area: 16,
          points: [[6, 0], [10, 4], [6, 8]],
          sepOffset: [72, 0],
          heightLine: {
            x1: 6,
            y1: 4,
            x2: 10,
            y2: 4,
            rightAngle: { x: 6, y: 4, dirX: 1, dirY: -1 },
            label: 'h = 4 см',
            labelDx: 8,
            labelDy: -22
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 2, x2: 6, y2: 2, offsetPx: -24, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 0, y2: 2, offsetPx: -34, text: '4 см', color: '#2563EB' },
        { x1: 6, y1: 0, x2: 6, y2: 2, offsetPx: -28, text: '2 см', color: '#059669' },
        { x1: 6, y1: 6, x2: 6, y2: 8, offsetPx: -28, text: '2 см', color: '#059669' }
      ]
    },

    L6_TASK5: {
      id: 'L6_TASK5',
      title: 'Задача 5. Парковый участок',
      outerContour: [[0, 0], [9, 0], [9, 3], [5, 6], [0, 6]],
      splitLines: [
        { x1: 5, y1: 0, x2: 5, y2: 6 },
        { x1: 5, y1: 3, x2: 9, y2: 3 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Левый прямоугольник (5 × 6 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '5 × 6 = 30 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 5 × 6 = 30 см²',
          area: 30,
          points: [[0, 0], [5, 0], [5, 6], [0, 6]],
          sepOffset: [-66, 0]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Правый верхний прямоугольник (4 × 3 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '4 × 3 = 12 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 4 × 3 = 12 см²',
          area: 12,
          points: [[5, 0], [9, 0], [9, 3], [5, 3]],
          sepOffset: [68, -30]
        },
        {
          id: 'p3',
          type: 'tri1',
          name: 'Нижний треугольник (a = 4 см, h = 3 см)',
          shortLabel: 'Треугольник',
          dimSummary: '(4 × 3) : 2 = 6 см²',
          formula: 'S₃ = (a × h) : 2',
          calcText: 'S₃ = (4 × 3) : 2 = 6 см²',
          area: 6,
          points: [[5, 3], [9, 3], [5, 6]],
          sepOffset: [68, 30],
          heightLine: {
            x1: 5,
            y1: 3,
            x2: 5,
            y2: 6,
            rightAngle: { x: 5, y: 3, dirX: 1, dirY: 1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: 9, y2: 0, offsetPx: -26, text: '9 см (5 + 4)', color: '#1E293B' },
        { x1: 0, y1: 6, x2: 0, y2: 0, offsetPx: -34, text: '6 см', color: '#2563EB' },
        { x1: 0, y1: 6, x2: 5, y2: 6, offsetPx: 28, text: '5 см', color: '#2563EB' },
        { x1: 9, y1: 0, x2: 9, y2: 3, offsetPx: -28, text: '3 см', color: '#4F46E5' }
      ]
    },

    L6_TASK6: {
      id: 'L6_TASK6',
      title: 'Задача 6 (Финальная). «Замок Геометрии» из 5 частей',
      outerContour: [
        [1.5, 0], [3, 2], [3, 3], [9, 3], [9, 2], [10.5, 0], [12, 2], [12, 7], [0, 7], [0, 2]
      ],
      splitLines: [
        { x1: 0, y1: 2, x2: 3, y2: 2 },
        { x1: 9, y1: 2, x2: 12, y2: 2 },
        { x1: 3, y1: 2, x2: 3, y2: 7 },
        { x1: 9, y1: 2, x2: 9, y2: 7 }
      ],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: 'Центральный зал (6 × 4 см)',
          shortLabel: 'Прямоугольник 1',
          dimSummary: '6 × 4 = 24 см²',
          formula: 'S₁ = a₁ × b₁',
          calcText: 'S₁ = 6 × 4 = 24 см²',
          area: 24,
          points: [[3, 3], [9, 3], [9, 7], [3, 7]],
          sepOffset: [0, 30]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: 'Левая башня (3 × 5 см)',
          shortLabel: 'Прямоугольник 2',
          dimSummary: '3 × 5 = 15 см²',
          formula: 'S₂ = a₂ × b₂',
          calcText: 'S₂ = 3 × 5 = 15 см²',
          area: 15,
          points: [[0, 2], [3, 2], [3, 7], [0, 7]],
          sepOffset: [-76, 18]
        },
        {
          id: 'p3',
          type: 'rect3',
          name: 'Правая башня (3 × 5 см)',
          shortLabel: 'Прямоугольник 3',
          dimSummary: '3 × 5 = 15 см²',
          formula: 'S₃ = a₃ × b₃',
          calcText: 'S₃ = 3 × 5 = 15 см²',
          area: 15,
          points: [[9, 2], [12, 2], [12, 7], [9, 7]],
          sepOffset: [76, 18]
        },
        {
          id: 'p4',
          type: 'tri1',
          name: 'Левый шпиль (a = 3 см, h = 2 см)',
          shortLabel: 'Треугольник 1',
          dimSummary: '(3 × 2) : 2 = 3 см²',
          formula: 'S₄ = (a × h) : 2',
          calcText: 'S₄ = (3 × 2) : 2 = 3 см²',
          area: 3,
          points: [[0, 2], [1.5, 0], [3, 2]],
          sepOffset: [-76, -34],
          badgeDx: 0,
          badgeDy: -34,
          heightLine: {
            x1: 1.5,
            y1: 0,
            x2: 1.5,
            y2: 2,
            rightAngle: { x: 1.5, y: 2, dirX: 1, dirY: -1 }
          }
        },
        {
          id: 'p5',
          type: 'tri2',
          name: 'Правый шпиль (a = 3 см, h = 2 см)',
          shortLabel: 'Треугольник 2',
          dimSummary: '(3 × 2) : 2 = 3 см²',
          formula: 'S₅ = (a × h) : 2',
          calcText: 'S₅ = (3 × 2) : 2 = 3 см²',
          area: 3,
          points: [[9, 2], [10.5, 0], [12, 2]],
          sepOffset: [76, -34],
          badgeDx: 0,
          badgeDy: -34,
          heightLine: {
            x1: 10.5,
            y1: 0,
            x2: 10.5,
            y2: 2,
            rightAngle: { x: 10.5, y: 2, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 7, x2: 3, y2: 7, offsetPx: 26, text: '3 см', color: '#4F46E5' },
        { x1: 3, y1: 7, x2: 9, y2: 7, offsetPx: 26, text: '6 см', color: '#2563EB' },
        { x1: 9, y1: 7, x2: 12, y2: 7, offsetPx: 26, text: '3 см', color: '#7C3AED' },
        { x1: 0, y1: 7, x2: 0, y2: 2, offsetPx: -32, text: '5 см', color: '#4F46E5' },
        { x1: 3, y1: 3, x2: 9, y2: 3, offsetPx: -22, text: 'h зала = 4 см', color: '#2563EB' },
        { x1: 12, y1: 0, x2: 12, y2: 2, offsetPx: -30, text: 'h шпиля = 2 см', color: '#059669' }
      ]
    }
  };

  /**
   * Вспомогательные генераторы точных геометрических фигур для Тренажёра и Мини-проверок
   * также с большими векторами разнесения в стороны
   */
  function makeRectFigure(a, b, title) {
    return {
      title: title || `Прямоугольник ${a} × ${b} см`,
      outerContour: [[0, 0], [a, 0], [a, b], [0, b]],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: `Прямоугольник (${a} × ${b} см)`,
          shortLabel: `Прямоугольник`,
          dimSummary: `${a} × ${b} = ${a * b} см²`,
          formula: 'S = a × b',
          calcText: `S = ${a} × ${b} = ${a * b} см²`,
          area: a * b,
          points: [[0, 0], [a, 0], [a, b], [0, b]],
          sepOffset: [0, 0],
          rightAngle: { x: 0, y: b, dirX: 1, dirY: -1 }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: a, y2: 0, offsetPx: -24, text: `${a} см`, color: '#2563EB' },
        { x1: 0, y1: b, x2: 0, y2: 0, offsetPx: -32, text: `${b} см`, color: '#2563EB' }
      ]
    };
  }

  function makeRightTriFigure(a, h, title) {
    return {
      title: title || `Треугольник: основание ${a} см, высота ${h} см`,
      outerContour: [[0, 0], [a, h], [0, h]],
      parts: [
        {
          id: 'p1',
          type: 'tri1',
          name: `Треугольник (a = ${a} см, h = ${h} см)`,
          shortLabel: `Треугольник`,
          dimSummary: `(${a} × ${h}) : 2 = ${(a * h) / 2} см²`,
          formula: 'S = (a × h) : 2',
          calcText: `S = (${a} × ${h}) : 2 = ${(a * h) / 2} см²`,
          area: (a * h) / 2,
          points: [[0, 0], [a, h], [0, h]],
          sepOffset: [0, 0],
          heightLine: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: h,
            rightAngle: { x: 0, y: h, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: h, x2: a, y2: h, offsetPx: 26, text: `a = ${a} см`, color: '#059669' },
        { x1: 0, y1: h, x2: 0, y2: 0, offsetPx: -34, text: `h = ${h} см`, color: '#0284C7' }
      ]
    };
  }

  function makeIsoTriFigure(a, h, title) {
    const mid = a / 2;
    return {
      title: title || `Треугольник: основание ${a} см, высота ${h} см`,
      outerContour: [[mid, 0], [a, h], [0, h]],
      parts: [
        {
          id: 'p1',
          type: 'tri1',
          name: `Треугольник (a = ${a} см, h = ${h} см)`,
          shortLabel: `Треугольник`,
          dimSummary: `(${a} × ${h}) : 2 = ${(a * h) / 2} см²`,
          formula: 'S = (a × h) : 2',
          calcText: `S = (${a} × ${h}) : 2 = ${(a * h) / 2} см²`,
          area: (a * h) / 2,
          points: [[mid, 0], [a, h], [0, h]],
          sepOffset: [0, 0],
          heightLine: {
            x1: mid,
            y1: 0,
            x2: mid,
            y2: h,
            rightAngle: { x: mid, y: h, dirX: 1, dirY: -1 },
            label: `h = ${h} см`,
            labelDx: 38,
            labelDy: 0
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: h, x2: a, y2: h, offsetPx: 26, text: `a = ${a} см`, color: '#059669' }
      ]
    };
  }

  function makeLShapeFigure(w1, h1, w2, h2) {
    const s1 = w1 * h1;
    const s2 = w2 * h2;
    return {
      title: `L-образная фигура (${w1}×${h1} и ${w2}×${h2})`,
      outerContour: [[0, 0], [w1, 0], [w1, h1], [w2, h1], [w2, h1 + h2], [0, h1 + h2]],
      splitLines: [{ x1: 0, y1: h1, x2: w2, y2: h1 }],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: `Прямоугольник 1 (${w1} × ${h1} см)`,
          shortLabel: `Прямоугольник 1`,
          dimSummary: `${w1} × ${h1} = ${s1} см²`,
          formula: 'S₁ = a₁ × b₁',
          calcText: `S₁ = ${w1} × ${h1} = ${s1} см²`,
          area: s1,
          points: [[0, 0], [w1, 0], [w1, h1], [0, h1]],
          sepOffset: [-48, -28]
        },
        {
          id: 'p2',
          type: 'rect2',
          name: `Прямоугольник 2 (${w2} × ${h2} см)`,
          shortLabel: `Прямоугольник 2`,
          dimSummary: `${w2} × ${h2} = ${s2} см²`,
          formula: 'S₂ = a₂ × b₂',
          calcText: `S₂ = ${w2} × ${h2} = ${s2} см²`,
          area: s2,
          points: [[0, h1], [w2, h1], [w2, h1 + h2], [0, h1 + h2]],
          sepOffset: [68, 28]
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: w1, y2: 0, offsetPx: -24, text: `${w1} см`, color: '#2563EB' },
        { x1: w1, y1: 0, x2: w1, y2: h1, offsetPx: -26, text: `${h1} см`, color: '#2563EB' },
        { x1: 0, y1: h1 + h2, x2: w2, y2: h1 + h2, offsetPx: 26, text: `${w2} см`, color: '#4F46E5' },
        { x1: w2, y1: h1, x2: w2, y2: h1 + h2, offsetPx: -26, text: `${h2} см`, color: '#4F46E5' }
      ]
    };
  }

  function makeRectPlusTriRight(wRect, hRect, aTri) {
    const s1 = wRect * hRect;
    const s2 = (aTri * hRect) / 2;
    return {
      title: `Прямоугольник ${wRect}×${hRect} и треугольник ${aTri}×${hRect}`,
      outerContour: [[0, 0], [wRect, 0], [wRect + aTri, hRect], [0, hRect]],
      splitLines: [{ x1: wRect, y1: 0, x2: wRect, y2: hRect }],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: `Прямоугольник (${wRect} × ${hRect} см)`,
          shortLabel: `Прямоугольник`,
          dimSummary: `${wRect} × ${hRect} = ${s1} см²`,
          formula: 'S₁ = a × b',
          calcText: `S₁ = ${wRect} × ${hRect} = ${s1} см²`,
          area: s1,
          points: [[0, 0], [wRect, 0], [wRect, hRect], [0, hRect]],
          sepOffset: [-68, 0]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: `Треугольник (a = ${aTri} см, h = ${hRect} см)`,
          shortLabel: `Треугольник`,
          dimSummary: `(${aTri} × ${hRect}) : 2 = ${s2} см²`,
          formula: 'S₂ = (a × h) : 2',
          calcText: `S₂ = (${aTri} × ${hRect}) : 2 = ${s2} см²`,
          area: s2,
          points: [[wRect, 0], [wRect + aTri, hRect], [wRect, hRect]],
          sepOffset: [68, 0],
          badgeDx: 10,
          badgeDy: 32,
          heightLine: {
            x1: wRect,
            y1: 0,
            x2: wRect,
            y2: hRect,
            rightAngle: { x: wRect, y: hRect, dirX: 1, dirY: -1 }
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: 0, x2: wRect, y2: 0, offsetPx: -24, text: `${wRect} см`, color: '#2563EB' },
        { x1: 0, y1: hRect, x2: 0, y2: 0, offsetPx: -32, text: `${hRect} см`, color: '#2563EB' },
        { x1: 0, y1: hRect, x2: wRect, y2: hRect, offsetPx: 26, text: `${wRect} см`, color: '#2563EB' },
        { x1: wRect, y1: hRect, x2: wRect + aTri, y2: hRect, offsetPx: 26, text: `a = ${aTri} см`, color: '#059669' }
      ]
    };
  }

  function makeHouseFigure(w, hRect, hRoof) {
    const s1 = w * hRect;
    const s2 = (w * hRoof) / 2;
    const mid = w / 2;
    return {
      title: `Домик: стены ${w}×${hRect} см, крыша h=${hRoof} см`,
      outerContour: [[mid, 0], [w, hRoof], [w, hRoof + hRect], [0, hRoof + hRect], [0, hRoof]],
      splitLines: [{ x1: 0, y1: hRoof, x2: w, y2: hRoof }],
      parts: [
        {
          id: 'p1',
          type: 'rect1',
          name: `Прямоугольник (${w} × ${hRect} см)`,
          shortLabel: `Прямоугольник`,
          dimSummary: `${w} × ${hRect} = ${s1} см²`,
          formula: 'S₁ = a × b',
          calcText: `S₁ = ${w} × ${hRect} = ${s1} см²`,
          area: s1,
          points: [[0, hRoof], [w, hRoof], [w, hRoof + hRect], [0, hRoof + hRect]],
          sepOffset: [-52, 26]
        },
        {
          id: 'p2',
          type: 'tri1',
          name: `Треугольник (a = ${w} см, h = ${hRoof} см)`,
          shortLabel: `Треугольник`,
          dimSummary: `(${w} × ${hRoof}) : 2 = ${s2} см²`,
          formula: 'S₂ = (a × h) : 2',
          calcText: `S₂ = (${w} × ${hRoof}) : 2 = ${s2} см²`,
          area: s2,
          points: [[0, hRoof], [mid, 0], [w, hRoof]],
          sepOffset: [52, -26],
          badgeDx: 0,
          badgeDy: -18,
          heightLine: {
            x1: mid,
            y1: 0,
            x2: mid,
            y2: hRoof,
            rightAngle: { x: mid, y: hRoof, dirX: 1, dirY: -1 },
            label: `h = ${hRoof} см`,
            labelDx: 38,
            labelDy: 0
          }
        }
      ],
      dimensions: [
        { x1: 0, y1: hRoof + hRect, x2: w, y2: hRoof + hRect, offsetPx: 26, text: `${w} см`, color: '#2563EB' },
        { x1: 0, y1: hRoof + hRect, x2: 0, y2: hRoof, offsetPx: -32, text: `${hRect} см`, color: '#2563EB' }
      ]
    };
  }

  return {
    FIGURES,
    renderScene,
    renderAreaSymbol,
    renderPartCalcWithIcon,
    renderTotalCalcWithIcons,
    renderConditionBoxHTML,
    makeRectFigure,
    makeRightTriFigure,
    makeIsoTriFigure,
    makeLShapeFigure,
    makeRectPlusTriRight,
    makeHouseFigure
  };
})();
