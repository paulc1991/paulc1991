(function () {
  const BRAND = window.CALCULATOR_BRAND;
  const DATA = window.CALCULATOR_DATA;
  const CALC = window.CalculatorCalcs;

  const $ = (id) => document.getElementById(id);

  function currency(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  function pct(n) {
    return `${(Number(n) || 0).toFixed(1)}%`;
  }

  function structureType() {
    return Array.from(document.querySelectorAll('input[name="structureType"]')).find((r) => r.checked)?.value || 'crut';
  }

  function applyBrand() {
    const root = document.documentElement;
    root.style.setProperty('--primary', BRAND.primaryColor);
    root.style.setProperty('--accent', BRAND.accentColor);
    root.style.setProperty('--ink', BRAND.inkColor);
    root.style.setProperty('--beneficiary', BRAND.accentColor);

    $('brandSiteName').textContent = BRAND.siteName;
    $('brandPageTitle').textContent = BRAND.pageTitle;
    $('brandIntroText').textContent = BRAND.introText;
    $('requestIllustrationBtn').textContent = BRAND.requestCtaText;
    $('contactGiftPlanningBtn').textContent = BRAND.contactCtaText;

    if (BRAND.logoUrl) {
      $('brandLogo').src = BRAND.logoUrl;
      $('brandLogo').alt = BRAND.logoAlt || BRAND.siteName;
      $('brandLogoWrap').classList.remove('hidden');
    }
  }

  function setDefaults() {
    const d = DATA.defaults;
    $('accountValue').value = d.accountValue;
    $('growthRate').value = d.growthRate;
    $('capitalAppreciationRate').value = d.capitalAppreciationRate;
    $('interestIncomeRate').value = d.interestIncomeRate;
    $('payoutRate').value = d.payoutRate;
    $('distributionTaxRate').value = d.distributionTaxRate;
    $('afterTaxInvestingTaxRate').value = d.afterTaxInvestingTaxRate;
    $('ownerAge').value = d.ownerAge;
    $('beneficiaryAge').value = d.beneficiaryAge;
    $('termYears').value = d.termYears;
    $('termYears').dataset.manual = 'false';
    $('payoutTiming').value = d.payoutTiming;
    $('scenarioMode').value = d.scenarioMode;
    document.querySelector(`input[name="structureType"][value="${d.structureType}"]`).checked = true;
    enforceOwnerAge73Rule();
  }

  function readValues() {
    return {
      accountValue: Number($('accountValue').value),
      growthRate: Number($('growthRate').value),
      capitalAppreciationRate: Number($('capitalAppreciationRate').value),
      interestIncomeRate: Number($('interestIncomeRate').value),
      structureType: structureType(),
      payoutRate: Number($('payoutRate').value),
      distributionTaxRate: Number($('distributionTaxRate').value),
      afterTaxInvestingTaxRate: Number($('afterTaxInvestingTaxRate').value),
      ownerAge: Number($('ownerAge').value),
      beneficiaryAge: Number($('beneficiaryAge').value),
      termYears: Number($('termYears').value),
      payoutTiming: $('payoutTiming').value,
      scenarioMode: $('scenarioMode').value
    };
  }

  function autoBalanceFromCapital() {
    const cap = Math.max(0, Math.min(100, Number($('capitalAppreciationRate').value) || 0));
    $('capitalAppreciationRate').value = cap.toFixed(1);
    $('interestIncomeRate').value = (100 - cap).toFixed(1);
  }

  function autoBalanceFromInterest() {
    const int = Math.max(0, Math.min(100, Number($('interestIncomeRate').value) || 0));
    $('interestIncomeRate').value = int.toFixed(1);
    $('capitalAppreciationRate').value = (100 - int).toFixed(1);
  }

  function syncTermFromAgeIfAuto() {
    if ($('termYears').dataset.manual === 'true') return;
    $('termYears').value = CALC.lifeTermFromBeneficiaryAge(Number($('beneficiaryAge').value));
  }

  function enforceOwnerAge73Rule() {
    const ownerAge = Number($('ownerAge').value);
    const year10 = $('optionYear10');
    if (ownerAge >= 73) {
      year10.disabled = true;
      if ($('scenarioMode').value === 'year_10_distribution') {
        $('scenarioMode').value = 'annual_distribution_plus_year_10';
      }
    } else {
      year10.disabled = false;
    }
  }

  function renderAssumptions(v) {
    const rows = [
      ['Principal', currency(v.accountValue)],
      ['Annual return', pct(v.growthRate)],
      ['Capital appreciation', pct(v.capitalAppreciationRate)],
      ['Interest income', pct(v.interestIncomeRate)],
      ['Structure', v.structureType === 'crut' ? 'CRUT' : 'CRAT/CGA'],
      ['Payout rate', pct(v.payoutRate)],
      ['Pre-tax withdrawal tax rate', pct(v.distributionTaxRate)],
      ['After-tax investing tax rate', pct(v.afterTaxInvestingTaxRate)],
      ['Owner age', v.ownerAge],
      ['Beneficiary age', v.beneficiaryAge],
      ['Term', `${v.termYears} years`],
      ['Comparison method', $('scenarioMode').selectedOptions[0].textContent]
    ];

    $('assumptionsSummary').innerHTML = rows.map((r) => `<div class="row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('');
  }

  function renderMetrics(el, list) {
    el.innerHTML = list.map((m) => `<div class="metric-row"><span>${m[0]}</span><strong>${m[1]}</strong></div>`).join('');
  }

  function renderBars(a, b) {
    const aIncome = a.incomeBenefit;
    const aRemain = a.remainingOutsideValue;
    const aTax = a.taxesPaid;
    const bIncome = b.incomeBenefit;
    const bCharity = b.projectedRemainderToCharity;

    const max = Math.max(aIncome + aRemain + aTax, bIncome + bCharity, 1) * 1.05;
    const maxH = 300;

    const hAIncome = Math.max(8, (aIncome / max) * maxH);
    const hARemain = (aRemain / max) * maxH;
    const hATax = (aTax / max) * maxH;

    const hBIncome = Math.max(8, (bIncome / max) * maxH);
    const hBCharity = (bCharity / max) * maxH;

    $('barA').style.height = `${hAIncome + hARemain + hATax}px`;
    $('barB').style.height = `${hBIncome + hBCharity}px`;
    $('barABeneficiary').style.height = `${hAIncome}px`;
    $('barARemaining').style.height = `${hARemain}px`;
    $('barATax').style.height = `${hATax}px`;
    $('barBBeneficiary').style.height = `${hBIncome}px`;
    $('barBCharity').style.height = `${hBCharity}px`;

    $('barATotal').textContent = `${currency(aIncome)} income | ${currency(aRemain)} remaining`;
    $('barBTotal').textContent = `${currency(bIncome)} income | ${currency(bCharity)} charity`;
    $('barBLabel').textContent = `Option B (${structureType() === 'crut' ? 'CRUT' : 'CRAT/CGA'})`;

    let y = '';
    for (let i = 0; i <= 5; i++) {
      const top = i * 20;
      const val = max * ((5 - i) / 5);
      y += `<div style="top:${top}%">${currency(val)}</div>`;
    }
    $('yLabels').innerHTML = y;
  }

  function renderTable(a, b) {
    const years = Math.max(a.annualRows.length, b.annualRows.length);
    let html = '<thead><tr><th>Year</th><th>A IRA Begin</th><th>A IRA Dist</th><th>A Outside Income</th><th>A Outside Value</th><th>A Taxes</th><th>B Begin</th><th>B Payout</th><th>B Taxes</th><th>B End</th></tr></thead><tbody>';
    for (let i = 0; i < years; i++) {
      const ra = a.annualRows[i] || {};
      const rb = b.annualRows[i] || {};
      const aTaxes = (ra.iraTax || 0) + (ra.outsideGrowthTax || 0) + (ra.outsideWithdrawalTax || 0);
      html += `<tr>
        <td>${i + 1}</td>
        <td>${currency(ra.iraBegin || 0)}</td>
        <td>${currency(ra.iraDistribution || 0)}</td>
        <td>${currency(ra.outsideNetIncome || 0)}</td>
        <td>${currency(ra.outsideAfterTaxValue || 0)}</td>
        <td>${currency(aTaxes)}</td>
        <td>${currency(rb.trustBegin || 0)}</td>
        <td>${currency(rb.trustDistribution || 0)}</td>
        <td>${currency(rb.trustTax || 0)}</td>
        <td>${currency(rb.trustEnd || 0)}</td>
      </tr>`;
    }
    html += '</tbody>';
    $('detailTable').innerHTML = html;
  }

  function renderWarnings(messages) {
    if (!messages.length) {
      $('warningsBox').classList.add('hidden');
      $('warningsList').innerHTML = '';
      return;
    }
    $('warningsBox').classList.remove('hidden');
    $('warningsList').innerHTML = messages.map((m) => `<p class="warning">• ${m}</p>`).join('');
  }

  function updateCTA(v, a, b) {
    const summary = [
      `Principal ${currency(v.accountValue)}`,
      `Term ${v.termYears} years`,
      `Option A income ${currency(a.incomeBenefit)}`,
      `Option B income ${currency(b.incomeBenefit)}`,
      `Projected charity remainder ${currency(b.projectedRemainderToCharity)}`
    ].join(' | ');

    const subject = BRAND.inquirySubject || 'Charitable Legacy Income Trust Inquiry';
    const body = `Please send a personalized illustration.%0D%0A%0D%0A${encodeURIComponent(summary)}`;
    $('requestIllustrationBtn').href = `mailto:${encodeURIComponent(BRAND.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${body}`;
    $('contactGiftPlanningBtn').href = `mailto:${encodeURIComponent(BRAND.contactEmail)}?subject=${encodeURIComponent(subject)}`;
  }

  function calculateAndRender() {
    const v = readValues();
    const a = CALC.scenarioA(v);
    const b = CALC.scenarioB(v);

    const warnings = CALC.validate(v);
    if (b.exhaustedEarly) warnings.push('Option B trust value exhausted before end of term.');
    if (v.structureType === 'crut' && b.impliedRemainderPct < 5) warnings.push('CRUT implied remainder is below 5%; remainder may be below common viability thresholds.');

    renderAssumptions(v);
    $('scenarioNotes').innerHTML = `
      <p><strong>Option A:</strong> ${$('scenarioMode').selectedOptions[0].textContent}.</p>
      <p><strong>Option B:</strong> ${v.structureType === 'crut' ? 'CRUT unitrust payout' : 'CRAT/CGA fixed annuity payout'} over the same ${v.termYears}-year term.</p>`;

    renderBars(a, b);

    const pvA = CALC.presentValueIncome(a.annualRows, 'outsideNetIncome', 3);
    const pvB = CALC.presentValueIncome(b.annualRows, 'trustDistribution', 3) * (1 - v.distributionTaxRate / 100);

    renderMetrics($('scenarioAMetrics'), [
      ['Income benefit to beneficiary', currency(a.incomeBenefit)],
      ['Remaining outside value', currency(a.remainingOutsideValue)],
      ['Estimated tax drag', currency(a.taxesPaid)],
      ['Present value of income (3%)', currency(pvA)]
    ]);

    $('scenarioBHead').textContent = `Metrics — Option B (${v.structureType === 'crut' ? 'CRUT' : 'CRAT/CGA'})`;
    renderMetrics($('scenarioBMetrics'), [
      ['Income benefit to beneficiary', currency(b.incomeBenefit)],
      ['Projected remainder to charity', currency(b.projectedRemainderToCharity)],
      ['Taxes on distributions', currency(b.taxesPaid)],
      ['Present value of income (3%)', currency(pvB)],
      ['Implied remainder % (CRUT)', v.structureType === 'crut' ? pct(b.impliedRemainderPct) : 'N/A']
    ]);

    const winner = (a.incomeBenefit + a.remainingOutsideValue) > (b.incomeBenefit + b.projectedRemainderToCharity) ? 'Option A' : 'Option B';
    $('narrativeSummary').textContent = `${winner} is higher on this illustration’s combined economic outcome measure. Option A combines beneficiary income plus remaining outside value. Option B combines beneficiary income plus projected charitable remainder.`;

    renderWarnings(warnings);
    renderTable(a, b);
    updateCTA(v, a, b);
  }

  function wireEvents() {
    $('calculateBtn').addEventListener('click', calculateAndRender);
    $('resetBtn').addEventListener('click', () => {
      setDefaults();
      calculateAndRender();
    });

    $('capitalAppreciationRate').addEventListener('input', autoBalanceFromCapital);
    $('interestIncomeRate').addEventListener('input', autoBalanceFromInterest);

    $('beneficiaryAge').addEventListener('input', syncTermFromAgeIfAuto);
    $('termYears').addEventListener('input', () => {
      $('termYears').dataset.manual = 'true';
    });
    $('defaultTermBtn').addEventListener('click', () => {
      $('termYears').dataset.manual = 'false';
      syncTermFromAgeIfAuto();
      calculateAndRender();
    });

    $('ownerAge').addEventListener('input', () => {
      enforceOwnerAge73Rule();
      calculateAndRender();
    });
  }

  applyBrand();
  setDefaults();
  wireEvents();
  calculateAndRender();
})();
