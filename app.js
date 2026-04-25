const moduleLibraryEl = document.getElementById('moduleLibrary');
const selectedModulesEl = document.getElementById('selectedModules');
const activeModuleEl = document.getElementById('activeModule');
const moduleFieldsEl = document.getElementById('moduleFields');
const runButton = document.getElementById('runButton');
const outputPanel = document.getElementById('outputPanel');
const outputTemplate = document.getElementById('outputTemplate');
const presentationCatalogEl = document.getElementById('presentationCatalog');
const refreshFeedsButton = document.getElementById('refreshFeeds');

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DATA_SOURCES = {
  rates7520: 'data/rates_7520.json',
  acgaRates: 'data/acga_rates.json',
  taxProfiles: 'data/tax_profiles.json',
  templateVersions: 'data/template_versions.json'
};

const PRESENTATION_CATALOG = {
  'Basic Charts': [
    'Summary of Benefits',
    'Comparison of Benefits',
    'Return Based on Cost of Plan',
    'Taxation of Gift Annuity Payments',
    'Actuarial Calculations',
    'Non-Charitable Interest Actuarials',
    'Termination of Gift Annuity'
  ],
  'Projection Charts': [
    'Summary of Benefits Projection',
    'Detailed Cash Flow Analysis',
    'Taxation Schedule',
    'Investment Assumptions',
    'Unitrust Makeup Analysis'
  ],
  'Diagrams / Graphs': [
    'Summary of Benefits - How It Works',
    'Summary of Benefits - Numbers',
    'Summary of Benefits Projection - Numbers',
    'Dollar Deductions Bar Graph',
    'Income Projection Line Graph'
  ],
  Narratives: [
    'Proposal Letter',
    'Proposal Cover Page',
    'Description and/or Example',
    'Long Description and/or Example',
    'Comparative Description',
    'Gift Annuity Disclosure Statement',
    'Acknowledgment Letter',
    'Gift Information Summary',
    'IRS Discount Rate Election Statement',
    'Gift Annuity Agreement'
  ]
};

const MODULES = {
  immediate: {
    label: 'Immediate Gift Annuity',
    description: 'Begins payments within one year.',
    fields: [
      { key: 'prorateFirstPayment', label: 'Prorate first payment?', type: 'select', options: ['Yes', 'No'], defaultValue: 'Yes' },
      { key: 'firstPaymentDate', label: 'Date of first payment', type: 'date' }
    ],
    resolve(input) { return { ...input, startDelayYears: 0, escalationRate: 0, rateAdjustment: 0, moduleNote: 'Immediate CGA payout starts right away.' }; }
  },
  deferred: {
    label: 'Deferred Gift Annuity',
    description: 'Defers payments to a fixed future date.',
    fields: [
      { key: 'deferYears', label: 'Deferral years', type: 'number', defaultValue: 7, min: 1, step: 1 },
      { key: 'firstPaymentDate', label: 'Date of first payment', type: 'date' }
    ],
    resolve(input) {
      const deferYears = Number(input.deferYears || 1);
      return { ...input, startDelayYears: deferYears, escalationRate: 0, rateAdjustment: Math.min(deferYears * 0.0025, 0.04), moduleNote: 'Deferred CGA illustration with uplifted payout rate for later start.' };
    }
  },
  flexible: {
    label: 'Flexible Gift Annuity',
    description: 'Annuitant elects a later start age.',
    fields: [
      { key: 'electedStartAge', label: 'Elected start age', type: 'number', defaultValue: 80, min: 18, max: 110 },
      { key: 'showElectionGrid', label: 'Show election options table?', type: 'select', options: ['Yes', 'No'], defaultValue: 'Yes' }
    ],
    resolve(input) {
      const electedStartAge = Number(input.electedStartAge || input.annuitantAge + 1);
      return { ...input, startDelayYears: Math.max(1, electedStartAge - input.annuitantAge), escalationRate: 0, rateAdjustment: 0.01, moduleNote: 'Flexible CGA: payout adjusts based on elected start age.' };
    }
  },
  commuted: {
    label: 'Commuted Gift Annuity',
    description: 'Models a commutation event/lump-sum settlement.',
    fields: [
      { key: 'commuteYear', label: 'Commutation year', type: 'number', defaultValue: 12, min: 1, step: 1 },
      { key: 'commutationDiscount', label: 'Commutation discount %', type: 'number', defaultValue: 5, min: 0, max: 25, step: 0.1 }
    ],
    resolve(input) { return { ...input, startDelayYears: 0, escalationRate: 0, rateAdjustment: -0.001, moduleNote: 'Commuted module includes estimated lump-sum settlement value at selected year.' }; }
  },
  stepped: {
    label: 'Stepped / Escalating CGA',
    description: 'Fixed pre-scheduled payment increases.',
    fields: [
      { key: 'escalationRate', label: 'Escalation rate %', type: 'number', defaultValue: 2, min: 0, max: 10, step: 0.1 },
      { key: 'stepFrequency', label: 'Step frequency (years)', type: 'number', defaultValue: 1, min: 1, max: 10, step: 1 }
    ],
    resolve(input) { return { ...input, startDelayYears: 0, rateAdjustment: 0, escalationRate: Number(input.escalationRate || 0) / 100, stepFrequency: Number(input.stepFrequency || 1), moduleNote: 'Stepped CGA assumes changes are fixed and predetermined.' }; }
  },
  testamentary: {
    label: 'Testamentary CGA',
    description: 'Funded at death through estate/IRA transfer.',
    fields: [
      { key: 'fundingSource', label: 'Funding source', type: 'select', options: ['Estate residue', 'IRA beneficiary transfer'], defaultValue: 'Estate residue' },
      { key: 'estateYear', label: 'Expected year of funding', type: 'number', defaultValue: new Date().getFullYear() + 2, min: 2026, step: 1 }
    ],
    resolve(input) { return { ...input, startDelayYears: 1, escalationRate: 0, rateAdjustment: 0, moduleNote: `Testamentary CGA modeled as funded via ${input.fundingSource || 'Estate residue'}.` }; }
  },
  twoLife: {
    label: 'Two-Life / Joint & Survivor CGA',
    description: 'Payments continue until last annuitant death.',
    fields: [
      { key: 'survivorPercentage', label: 'Survivor continuation %', type: 'number', defaultValue: 100, min: 50, max: 100, step: 1 },
      { key: 'jointLifeAdjustment', label: 'Joint-life conservative adjustment %', type: 'number', defaultValue: 0.5, min: 0, max: 3, step: 0.1 }
    ],
    resolve(input) {
      const ageSpreadPenalty = Math.max(Math.abs(input.annuitantAge - input.secondaryAge) - 5, 0) * 0.0005;
      return { ...input, projectionYears: Math.max(input.projectionYears, 30), startDelayYears: 0, escalationRate: 0, rateAdjustment: -(Number(input.jointLifeAdjustment || 0.5) / 100) - ageSpreadPenalty, moduleNote: 'Two-life model uses survivor life horizon and conservative payout adjustment.' };
    }
  }
};

const state = {
  selectedModules: ['immediate', 'deferred', 'commuted'],
  activeModule: 'immediate',
  selectedPresentations: new Set([
    'Summary of Benefits',
    'Taxation of Gift Annuity Payments',
    'Actuarial Calculations',
    'Non-Charitable Interest Actuarials',
    'Termination of Gift Annuity',
    'Summary of Benefits Projection',
    'Detailed Cash Flow Analysis',
    'Summary of Benefits - Numbers',
    'Income Projection Line Graph',
    'Proposal Letter',
    'Description and/or Example',
    'Long Description and/or Example',
    'Gift Annuity Disclosure Statement'
  ]),
  feeds: {}
};

initialize();

async function initialize() {
  document.querySelector('input[name="headingDate"]').value = todayISO();
  renderModuleLibrary();
  renderSelectedModules();
  renderActiveSelect();
  renderModuleFields();
  renderPresentationCatalog();

  await loadDataFeeds();
  applyFeedDefaults();

  runButton.addEventListener('click', handleRun);
  refreshFeedsButton.addEventListener('click', async () => {
    await loadDataFeeds(true);
    applyFeedDefaults();
  });

  activeModuleEl.addEventListener('change', () => {
    state.activeModule = activeModuleEl.value;
    renderModuleFields();
    applyFeedDefaults();
  });
}

async function loadDataFeeds(forceRefresh = false) {
  const entries = await Promise.all(Object.entries(DATA_SOURCES).map(([key, path]) => loadSingleFeed(key, path, forceRefresh)));
  state.feeds = Object.fromEntries(entries);
  updateFeedStatusUI();
}

async function loadSingleFeed(key, path, forceRefresh) {
  const cacheKey = `feed:${key}`;
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return [key, JSON.parse(cached)];
    }
  }

  const response = await fetch(path, { cache: 'no-store' });
  const payload = await response.json();
  localStorage.setItem(cacheKey, JSON.stringify(payload));
  return [key, payload];
}

function applyFeedDefaults() {
  const asOf = document.querySelector('input[name="headingDate"]').value || todayISO();
  const selectedModule = state.activeModule;
  const age = Number(document.getElementById('annuitantAge').value || 70);

  const section7520 = getCurrent7520Rate(asOf);
  if (section7520) {
    document.getElementById('discountRate').value = (section7520.rate * 100).toFixed(2);
  }

  const acga = getCurrentAcgaRate(asOf, selectedModule, age);
  if (acga) {
    document.getElementById('baseRate').value = (acga.rate * 100).toFixed(2);
  }

  const taxProfile = getCurrentTaxProfile(asOf);
  if (taxProfile) {
    document.getElementById('ordinaryTaxRate').value = (taxProfile.ordinary_income_rate * 100).toFixed(1);
    document.getElementById('capitalGainRate').value = (taxProfile.capital_gain_rate * 100).toFixed(1);
    document.getElementById('stateTaxRate').value = (taxProfile.state_tax_rate * 100).toFixed(1);
    document.getElementById('niitApplies').value = taxProfile.niit ? 'yes' : 'no';
  }
}

function getCurrent7520Rate(asOfDate) {
  const feed = state.feeds.rates7520;
  if (!feed?.records) return null;
  const month = asOfDate.slice(0, 7);
  return [...feed.records].reverse().find((row) => row.effective_month <= month) || null;
}

function getCurrentAcgaRate(asOfDate, arrangement, age) {
  const feed = state.feeds.acgaRates;
  if (!feed?.records) return null;

  const candidates = feed.records
    .filter((row) => row.effective_date <= asOfDate && row.arrangement === arrangement)
    .sort((a, b) => a.age - b.age);

  if (!candidates.length) {
    const fallback = feed.records
      .filter((row) => row.effective_date <= asOfDate && row.arrangement === 'immediate')
      .sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age));
    return fallback[0] || null;
  }

  return candidates.sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age))[0] || null;
}

function getCurrentTaxProfile(asOfDate) {
  const feed = state.feeds.taxProfiles;
  if (!feed?.records) return null;
  return [...feed.records].reverse().find((row) => row.effective_date <= asOfDate) || null;
}

function updateFeedStatusUI() {
  setStatus('status7520', state.feeds.rates7520);
  setStatus('statusAcga', state.feeds.acgaRates);
  setStatus('statusTax', state.feeds.taxProfiles);
  setStatus('statusTemplates', state.feeds.templateVersions);
}

function setStatus(elementId, feed) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (!feed) {
    el.textContent = 'Not loaded';
    return;
  }
  el.textContent = `v${feed.version} (updated ${feed.last_updated})`;
}

function renderPresentationCatalog() {
  presentationCatalogEl.innerHTML = '';
  Object.entries(PRESENTATION_CATALOG).forEach(([groupName, items]) => {
    const details = document.createElement('details');
    details.className = 'catalog-group';
    details.open = true;
    details.innerHTML = `<summary>${groupName}</summary>`;
    const list = document.createElement('div');
    list.className = 'catalog-list';

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'catalog-item';
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedPresentations.has(item);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.selectedPresentations.add(item);
        else state.selectedPresentations.delete(item);
      });
      label.append(checkbox, document.createTextNode(item));
      row.append(label);
      list.appendChild(row);
    });

    details.appendChild(list);
    presentationCatalogEl.appendChild(details);
  });
}

function renderModuleLibrary() {
  moduleLibraryEl.innerHTML = '';
  Object.entries(MODULES).forEach(([key, module]) => {
    const row = document.createElement('div');
    row.className = 'library-item';
    row.innerHTML = `<div><strong>${module.label}</strong><small>${module.description}</small></div>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'icon-btn';
    addBtn.textContent = '+';
    addBtn.disabled = state.selectedModules.includes(key) || state.selectedModules.length >= 3;
    addBtn.addEventListener('click', () => {
      if (state.selectedModules.length < 3 && !state.selectedModules.includes(key)) {
        state.selectedModules.push(key);
        state.activeModule = key;
        rerenderSelectionState();
      }
    });
    row.appendChild(addBtn);
    moduleLibraryEl.appendChild(row);
  });
}

function renderSelectedModules() {
  selectedModulesEl.innerHTML = '';
  state.selectedModules.forEach((key) => {
    const module = MODULES[key];
    const row = document.createElement('div');
    row.className = 'selected-item';
    row.innerHTML = `<div><strong>${module.label}</strong><small>${module.description}</small></div>`;
    const actions = document.createElement('div');
    const useBtn = document.createElement('button');
    useBtn.className = 'icon-btn';
    useBtn.textContent = '▶';
    useBtn.addEventListener('click', () => { state.activeModule = key; rerenderSelectionState(); applyFeedDefaults(); });
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => {
      state.selectedModules = state.selectedModules.filter((item) => item !== key);
      if (!state.selectedModules.length) state.selectedModules = ['immediate'];
      if (!state.selectedModules.includes(state.activeModule)) state.activeModule = state.selectedModules[0];
      rerenderSelectionState();
      applyFeedDefaults();
    });
    actions.append(useBtn, deleteBtn);
    row.append(actions);
    selectedModulesEl.appendChild(row);
  });
}

function rerenderSelectionState() {
  renderModuleLibrary();
  renderSelectedModules();
  renderActiveSelect();
  renderModuleFields();
}

function renderActiveSelect() {
  activeModuleEl.innerHTML = '';
  state.selectedModules.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = MODULES[key].label;
    activeModuleEl.appendChild(option);
  });
  activeModuleEl.value = state.activeModule;
}

function renderModuleFields() {
  moduleFieldsEl.innerHTML = '';
  MODULES[state.activeModule].fields.forEach((field) => {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = field.type === 'select' ? document.createElement('select') : document.createElement('input');
    if (field.type === 'select') {
      field.options.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        input.append(option);
      });
      input.value = field.defaultValue;
    } else {
      input.type = field.type;
      if (field.defaultValue !== undefined) input.value = field.defaultValue;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
    }
    input.name = `module_${field.key}`;
    label.appendChild(input);
    moduleFieldsEl.appendChild(label);
  });
}

function handleRun() {
  const core = getCoreInputs();
  const moduleKey = state.activeModule;
  const resolved = MODULES[moduleKey].resolve({ ...core, ...getModuleInputs(moduleKey) });
  const report = buildReport(moduleKey, resolved, Array.from(state.selectedPresentations));
  renderOutput(report);
}

function getCoreInputs() {
  const num = (name, fallback = 0) => Number(document.querySelector(`[name="${name}"]`)?.value ?? fallback);
  const str = (name, fallback = '') => String(document.querySelector(`[name="${name}"]`)?.value ?? fallback);
  return {
    preparedFor: str('preparedFor'),
    preparedBy: str('preparedBy'),
    headingDate: str('headingDate'),
    organization: str('organization'),
    disclaimerTone: str('disclaimerTone'),
    caseNotes: str('caseNotes'),
    propertyType: str('propertyType'),
    giftAmount: num('giftAmount'),
    costBasis: num('costBasis'),
    baseRate: num('baseRate') / 100,
    paymentFrequency: str('paymentFrequency'),
    paymentTiming: str('paymentTiming'),
    discountRate: num('discountRate') / 100,
    annuitantAge: num('annuitantAge'),
    secondaryAge: num('secondaryAge'),
    projectionYears: num('projectionYears', 25),
    ordinaryTaxRate: num('ordinaryTaxRate') / 100,
    capitalGainRate: num('capitalGainRate') / 100,
    stateTaxRate: num('stateTaxRate') / 100,
    niitApplies: str('niitApplies') === 'yes',
    stateAllowsDeduction: str('stateAllowsDeduction') === 'yes'
  };
}

function getModuleInputs(moduleKey) {
  const values = {};
  MODULES[moduleKey].fields.forEach((field) => {
    const el = document.querySelector(`[name="module_${field.key}"]`);
    if (!el) return;
    values[field.key] = field.type === 'number' ? Number(el.value) : el.value;
  });
  return values;
}

function buildReport(moduleKey, data, selectedPresentations) {
  const adjustedRate = Math.max(data.baseRate + (data.rateAdjustment || 0), 0.005);
  const annualPayment = data.giftAmount * adjustedRate;
  const years = Math.max(Math.min(data.projectionYears, 60), 5);

  const appreciation = Math.max(data.giftAmount - data.costBasis, 0);
  const capitalGainShare = data.propertyType === 'ltcg' && data.giftAmount > 0 ? Math.min(appreciation / data.giftAmount, 0.7) : 0;
  const taxFreeShare = Math.max(0.25, 0.65 - capitalGainShare);
  const ordinaryShare = Math.max(1 - taxFreeShare - capitalGainShare, 0.1);

  const schedule = [];
  for (let year = 1; year <= years; year += 1) {
    const payoutIndex = year - (data.startDelayYears || 0);
    const active = payoutIndex > 0;
    let payment = active ? annualPayment : 0;
    if (active && data.escalationRate) {
      const steps = Math.floor((payoutIndex - 1) / Number(data.stepFrequency || 1));
      payment *= (1 + data.escalationRate) ** steps;
    }

    schedule.push({
      year,
      age: data.annuitantAge + year - 1,
      payment,
      taxFree: payment * taxFreeShare,
      capitalGain: payment * capitalGainShare,
      ordinary: payment * ordinaryShare,
      discountedValue: payment / (1 + data.discountRate) ** year
    });
  }

  const pvLiability = schedule.reduce((sum, row) => sum + row.discountedValue, 0);
  const deduction = Math.max(data.giftAmount - pvLiability, 0);
  const annualCapitalTax = annualPayment * capitalGainShare * (data.capitalGainRate + (data.niitApplies ? 0.038 : 0));
  const annualOrdinaryTax = annualPayment * ordinaryShare * (data.ordinaryTaxRate + data.stateTaxRate);
  const annualTax = annualCapitalTax + annualOrdinaryTax;

  const docs = selectedPresentations.map((title) => ({
    title,
    description: presentationDescription(title, data, {
      annualPayment,
      deduction,
      annualAfterTax: annualPayment - annualTax,
      pvLiability,
      years
    })
  }));

  return {
    reportTitle: `${MODULES[moduleKey].label} — Illustration Package (${selectedPresentations.length} selected presentations)`,
    reportMeta: `${data.preparedFor} | ${data.organization} | ${formatDate(data.headingDate)}`,
    kpis: [
      ['Gift value', currency.format(data.giftAmount)],
      ['Initial annual payment', currency.format(schedule.find((x) => x.payment > 0)?.payment || 0)],
      ['Effective payout rate', percent.format(adjustedRate)],
      ['Estimated charitable deduction', currency.format(deduction)],
      ['After-tax annual income', currency.format(annualPayment - annualTax)],
      ['Present value of liability', currency.format(pvLiability)]
    ],
    taxRows: [
      ['Tax-free return of principal', currency.format(annualPayment * taxFreeShare), currency.format(0), currency.format(annualPayment * taxFreeShare)],
      ['Capital gain income', currency.format(annualPayment * capitalGainShare), currency.format(annualCapitalTax), currency.format(annualPayment * capitalGainShare - annualCapitalTax)],
      ['Ordinary income', currency.format(annualPayment * ordinaryShare), currency.format(annualOrdinaryTax), currency.format(annualPayment * ordinaryShare - annualOrdinaryTax)],
      ['Total annuity', currency.format(annualPayment), currency.format(annualTax), currency.format(annualPayment - annualTax)]
    ],
    actuarialFacts: [
      `Present value of annuity liability: ${currency.format(pvLiability)}.`,
      `Estimated charitable deduction: ${currency.format(deduction)} (${percent.format(deduction / data.giftAmount)} of gift).`,
      `Assumed discount (7520) rate: ${percent.format(data.discountRate)}.`,
      `Data versions: 7520 ${state.feeds.rates7520?.version || 'n/a'}, ACGA ${state.feeds.acgaRates?.version || 'n/a'}, tax ${state.feeds.taxProfiles?.version || 'n/a'}.`,
      data.moduleNote
    ],
    schedule,
    docs,
    disclaimer: buildDisclaimer(data)
  };
}

function presentationDescription(title, input, metrics) {
  const map = {
    'Summary of Benefits': `One-page KPI snapshot with payment ${currency.format(metrics.annualPayment)} and deduction ${currency.format(metrics.deduction)}.`,
    'Comparison of Benefits': 'Side-by-side comparison scaffold for selected gift options using normalized annual and after-tax income values.',
    'Return Based on Cost of Plan': `Demonstrates return on cost basis ${currency.format(input.costBasis)} relative to annuity cash flows.`,
    'Taxation of Gift Annuity Payments': 'Breaks each annual payment into tax-free, capital gain, and ordinary components.',
    'Actuarial Calculations': `Includes present value ${currency.format(metrics.pvLiability)} and deduction computations with assumptions.`,
    'Non-Charitable Interest Actuarials': 'Shows non-charitable interest values derived from residual annuity economics.',
    'Termination of Gift Annuity': 'Summarizes remaining value if annuity is terminated or commuted early.',
    'Summary of Benefits Projection': `Projection chart narrative across ${metrics.years} modeled years.`,
    'Detailed Cash Flow Analysis': 'Detailed annual cashflow schedule with discounting and tax character columns.',
    'Taxation Schedule': 'Tax schedule timeline using donor-specific federal/state/NIIT assumptions.',
    'Investment Assumptions': 'Documents payout, discount, and implied reinvestment assumptions for transparency.',
    'Unitrust Makeup Analysis': 'Reserved for blended plan workflow where CGA interacts with unitrust allocations.',
    'Summary of Benefits - How It Works': 'Explainer diagram describing gift transfer, annuity flow, and charitable remainder.',
    'Summary of Benefits - Numbers': 'Numeric version of the benefits summary for audit-style review.',
    'Summary of Benefits Projection - Numbers': 'Year-by-year table version of projection outputs.',
    'Dollar Deductions Bar Graph': 'Bar chart-ready dataset for deduction and tax savings estimates.',
    'Income Projection Line Graph': 'Line-chart ready annual income sequence from the projected schedule.',
    'Proposal Letter': 'Client-facing proposal letter using prepared-for fields and headline outcomes.',
    'Proposal Cover Page': 'Branded cover page including donor, advisor, date, and organization.',
    'Description and/or Example': 'Short narrative description with suggested talking points for donor meetings.',
    'Long Description and/or Example': 'Extended narrative with context, assumptions, and explanatory detail.',
    'Comparative Description': 'Narrative comparing this plan against alternate charitable gift structures.',
    'Gift Annuity Disclosure Statement': 'Disclosure template noting assumptions, ACGA table, and legal review points.',
    'Acknowledgment Letter': 'Template to acknowledge gift intent and communicate next administrative steps.',
    'Gift Information Summary': 'Administrative summary of gift value, basis, rates, and payout settings.',
    'IRS Discount Rate Election Statement': 'Statement template documenting 7520 discount rate election assumptions.',
    'Gift Annuity Agreement': 'Agreement-oriented summary draft with financial terms and payout setup.'
  };
  return map[title] || 'Presentation template generated from current case assumptions.';
}

function renderOutput(report) {
  outputPanel.innerHTML = '<h2>Illustration Output</h2>';
  const fragment = outputTemplate.content.cloneNode(true);
  fragment.querySelector('[data-field="reportTitle"]').textContent = report.reportTitle;
  fragment.querySelector('[data-field="reportMeta"]').textContent = report.reportMeta;

  const kpis = fragment.querySelector('[data-field="kpis"]');
  report.kpis.forEach(([label, value]) => {
    const node = document.createElement('div');
    node.className = 'kpi';
    node.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    kpis.appendChild(node);
  });

  appendTableRows(fragment.querySelector('[data-field="taxRows"]'), report.taxRows);
  appendList(fragment.querySelector('[data-field="actuarialFacts"]'), report.actuarialFacts);

  const scheduleBody = fragment.querySelector('[data-field="scheduleRows"]');
  report.schedule.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.year}</td><td>${row.age}</td><td>${currency.format(row.payment)}</td><td>${currency.format(row.taxFree)}</td><td>${currency.format(row.capitalGain)}</td><td>${currency.format(row.ordinary)}</td><td>${currency.format(row.discountedValue)}</td>`;
    scheduleBody.appendChild(tr);
  });

  const docsWrap = fragment.querySelector('[data-field="generatedPresentationDocs"]');
  report.docs.forEach((doc) => {
    const card = document.createElement('article');
    card.className = 'doc-card';
    card.innerHTML = `<h5>${doc.title}</h5><p>${doc.description}</p>`;
    docsWrap.appendChild(card);
  });

  fragment.querySelector('[data-field="disclaimer"]').textContent = report.disclaimer;
  outputPanel.appendChild(fragment);
}

function appendTableRows(target, rows) {
  target.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = row.map((cell) => `<td>${cell}</td>`).join('');
    target.appendChild(tr);
  });
}

function appendList(target, values) {
  target.innerHTML = '';
  values.forEach((value) => {
    const li = document.createElement('li');
    li.textContent = value;
    target.appendChild(li);
  });
}

function buildDisclaimer(input) {
  const toneMap = {
    illustration: 'For illustration purposes only.',
    internal: 'Internal planning use only; not a legal commitment.',
    client: 'Review all assumptions with tax and legal advisors before implementation.'
  };
  return `${toneMap[input.disclaimerTone] || toneMap.illustration} Data feeds used: 7520 ${state.feeds.rates7520?.version || 'n/a'}, ACGA ${state.feeds.acgaRates?.version || 'n/a'}, tax ${state.feeds.taxProfiles?.version || 'n/a'}, templates ${state.feeds.templateVersions?.version || 'n/a'}.`;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
