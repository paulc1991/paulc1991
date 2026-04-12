(function () {
  const DATA = window.CALCULATOR_DATA;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function lifeTermFromBeneficiaryAge(age) {
    const a = clamp(Math.round(Number(age) || 0), 0, 110);
    const divisor = DATA.irsSingleLifeExpectancy[a] || 2.3;
    return clamp(Math.round(divisor), 1, 60);
  }

  function divisorForYear(beneficiaryAge, year) {
    const a = clamp(Math.round(Number(beneficiaryAge) || 0), 0, 110);
    const base = DATA.irsSingleLifeExpectancy[a] || 2.3;
    return Math.max(1, base - (year - 1));
  }

  function growTaxableAccount(state, v) {
    if (state.market <= 0) return 0;
    const annual = v.growthRate / 100;
    const capShare = v.capitalAppreciationRate / 100;
    const intShare = v.interestIncomeRate / 100;
    const taxRate = v.afterTaxInvestingTaxRate / 100;

    const interest = state.market * annual * intShare;
    const interestTax = interest * taxRate;
    const netInterest = interest - interestTax;
    state.market += netInterest;
    state.basis += netInterest;

    const appreciation = state.market * annual * capShare;
    state.market += appreciation;
    return interestTax;
  }

  function withdrawTaxable(state, desired, taxRatePct) {
    if (state.market <= 0 || desired <= 0) return { gross: 0, tax: 0, net: 0 };
    const gross = Math.min(desired, state.market);
    const gainRatio = state.market > 0 ? Math.max(0, (state.market - state.basis) / state.market) : 0;
    const gainPart = gross * gainRatio;
    const tax = gainPart * (taxRatePct / 100);
    const basisPart = gross - gainPart;
    state.market -= gross;
    state.basis = Math.max(0, state.basis - basisPart);
    return { gross, tax, net: gross - tax };
  }

  function afterTaxOutsideValue(state, taxRatePct) {
    const gain = Math.max(0, state.market - state.basis);
    return Math.max(0, state.market - gain * (taxRatePct / 100));
  }

  function simulateOutside(deposits, v, withdrawStartYear) {
    const state = { market: 0, basis: 0 };
    const payoutRate = v.payoutRate / 100;
    let incomeNet = 0;
    let taxes = 0;
    const rows = [];

    for (let year = 1; year <= v.termYears; year++) {
      const deposit = deposits[year - 1] || 0;
      let withdrawTax = 0;
      let growthTax = 0;
      let netIncome = 0;

      if (v.payoutTiming === 'beginning_of_year') {
        if (year >= withdrawStartYear) {
          const w = withdrawTaxable(state, state.market * payoutRate, v.afterTaxInvestingTaxRate);
          withdrawTax = w.tax;
          netIncome = w.net;
        }
        growthTax = growTaxableAccount(state, v);
      } else {
        growthTax = growTaxableAccount(state, v);
        if (year >= withdrawStartYear) {
          const w = withdrawTaxable(state, state.market * payoutRate, v.afterTaxInvestingTaxRate);
          withdrawTax = w.tax;
          netIncome = w.net;
        }
      }

      state.market += deposit;
      state.basis += deposit;

      incomeNet += netIncome;
      taxes += growthTax + withdrawTax;

      rows.push({
        year,
        outsideDeposit: deposit,
        outsideNetIncome: netIncome,
        outsideGrowthTax: growthTax,
        outsideWithdrawalTax: withdrawTax,
        outsideAfterTaxValue: afterTaxOutsideValue(state, v.afterTaxInvestingTaxRate)
      });
    }

    taxes += Math.max(0, state.market - afterTaxOutsideValue(state, v.afterTaxInvestingTaxRate));

    return {
      incomeNet,
      taxes,
      remainingOutsideValue: afterTaxOutsideValue(state, v.afterTaxInvestingTaxRate),
      rows
    };
  }

  function scenarioA(v) {
    const g = v.growthRate / 100;
    const tax = v.distributionTaxRate / 100;
    let ira = v.accountValue;
    let iraTax = 0;
    const deposits = Array(v.termYears).fill(0);
    const rows = [];
    let method = v.scenarioMode;

    if (v.ownerAge >= 73 && method === 'year_10_distribution') {
      method = 'annual_distribution_plus_year_10';
    }

    if (method === 'immediate_distribution') {
      const net = v.accountValue * (1 - tax);
      deposits[0] = net;
      iraTax = v.accountValue * tax;
      for (let year = 1; year <= v.termYears; year++) {
        rows.push({ year, iraBegin: year === 1 ? v.accountValue : 0, iraDistribution: year === 1 ? v.accountValue : 0, iraTax: year === 1 ? iraTax : 0, iraEnd: 0 });
      }
      const outside = simulateOutside(deposits, v, 1);
      return packScenarioAResult(rows, outside, iraTax, method);
    }

    for (let year = 1; year <= v.termYears; year++) {
      const begin = ira;
      let dist = 0;
      let end = begin;

      if (year <= 10) {
        if (method === 'year_10_distribution') {
          end = begin * (1 + g);
          if (year === 10) {
            dist = end;
            end = 0;
          }
        } else {
          if (year < 10) {
            const divisor = divisorForYear(v.beneficiaryAge, year);
            dist = Math.min(begin, begin / divisor);
          } else {
            dist = begin;
          }

          if (v.payoutTiming === 'beginning_of_year') {
            const postDist = Math.max(0, begin - dist);
            end = postDist * (1 + g);
          } else {
            end = Math.max(0, begin * (1 + g) - dist);
          }
        }
      } else {
        end = 0;
      }

      const yrTax = dist * tax;
      const net = dist - yrTax;
      iraTax += yrTax;
      deposits[year - 1] = net;
      rows.push({ year, iraBegin: begin, iraDistribution: dist, iraTax: yrTax, iraEnd: end });
      ira = end;
    }

    const outside = simulateOutside(deposits, v, 11);
    return packScenarioAResult(rows, outside, iraTax, method);
  }

  function packScenarioAResult(rows, outside, iraTax, method) {
    const annualRows = rows.map((r, i) => ({ ...r, ...outside.rows[i] }));
    return {
      method,
      incomeBenefit: outside.incomeNet,
      remainingOutsideValue: outside.remainingOutsideValue,
      taxesPaid: iraTax + outside.taxes,
      annualRows
    };
  }

  function scenarioB(v) {
    const g = v.growthRate / 100;
    const payoutRate = v.payoutRate / 100;
    const taxRate = v.distributionTaxRate / 100;
    const fixed = v.accountValue * payoutRate;
    let trust = v.accountValue;
    let incomeNet = 0;
    let taxes = 0;
    const rows = [];

    for (let year = 1; year <= v.termYears; year++) {
      if (trust <= 0) break;
      const begin = trust;
      let dist = 0;
      if (v.structureType === 'crut') {
        dist = begin * payoutRate;
      } else {
        const maxAvailable = v.payoutTiming === 'end_of_year' ? begin * (1 + g) : begin;
        dist = Math.min(fixed, maxAvailable);
      }

      let end;
      if (v.payoutTiming === 'beginning_of_year') {
        const post = Math.max(0, begin - dist);
        end = post * (1 + g);
      } else {
        end = Math.max(0, begin * (1 + g) - dist);
      }

      const t = dist * taxRate;
      incomeNet += dist - t;
      taxes += t;
      rows.push({ year, trustBegin: begin, trustDistribution: dist, trustTax: t, trustEnd: end });
      trust = end;
    }

    return {
      incomeBenefit: incomeNet,
      projectedRemainderToCharity: Math.max(0, trust),
      taxesPaid: taxes,
      exhaustedEarly: trust <= 0 && rows.length < v.termYears,
      impliedRemainderPct: v.accountValue > 0 ? (Math.max(0, trust) / v.accountValue) * 100 : 0,
      annualRows: rows
    };
  }

  function presentValueIncome(annualRows, field, discountRate) {
    const d = discountRate / 100;
    return annualRows.reduce((sum, r) => sum + ((r[field] || 0) / Math.pow(1 + d, r.year)), 0);
  }

  function validate(v) {
    const warnings = [];
    if (Math.abs(v.capitalAppreciationRate + v.interestIncomeRate - 100) > 0.01) {
      warnings.push('Capital appreciation + interest income must total 100%.');
    }
    if (v.structureType === 'crut' && v.payoutRate > v.growthRate) {
      warnings.push('CRUT payout rate exceeds annual return assumption.');
    }
    if (v.ownerAge >= 73 && v.scenarioMode === 'year_10_distribution') {
      warnings.push('Owner age 73+ disables the 10-year deferral option; annual distribution method was used.');
    }
    return warnings;
  }

  window.CalculatorCalcs = {
    lifeTermFromBeneficiaryAge,
    divisorForYear,
    scenarioA,
    scenarioB,
    presentValueIncome,
    validate
  };
})();
