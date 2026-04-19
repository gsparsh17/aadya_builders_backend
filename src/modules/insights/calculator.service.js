/**
 * Calculator Service - Handles EMI, affordability, and area calculations
 */
class CalculatorService {
  
  /**
   * Calculate Home Loan EMI
   */
  calculateEMI(params) {
    const { principal, interestRate, tenure, tenureUnit = 'years' } = params;
    
    // Convert tenure to months
    const tenureMonths = tenureUnit === 'years' ? tenure * 12 : tenure;
    
    // Monthly interest rate
    const monthlyRate = interestRate / 12 / 100;
    
    // EMI Formula: P * r * (1+r)^n / ((1+r)^n - 1)
    let emi = 0;
    let totalInterest = 0;
    let totalPayment = 0;
    
    if (monthlyRate === 0) {
      emi = principal / tenureMonths;
      totalInterest = 0;
    } else {
      const compoundFactor = Math.pow(1 + monthlyRate, tenureMonths);
      emi = principal * monthlyRate * compoundFactor / (compoundFactor - 1);
      totalInterest = (emi * tenureMonths) - principal;
    }
    
    totalPayment = principal + totalInterest;
    
    // Generate amortization schedule
    const schedule = this.generateAmortizationSchedule(
      principal,
      monthlyRate,
      tenureMonths,
      emi
    );
    
    // Calculate year-wise breakdown
    const yearlyBreakdown = this.getYearlyBreakdown(schedule);
    
    return {
      summary: {
        monthlyEMI: Math.round(emi),
        principal: principal,
        totalInterest: Math.round(totalInterest),
        totalPayment: Math.round(totalPayment),
        interestRate: interestRate,
        tenure: tenure,
        tenureUnit: tenureUnit,
        tenureMonths: tenureMonths
      },
      yearlyBreakdown,
      schedule: schedule.slice(0, 12) // First year only for detailed view
    };
  }

  /**
   * Generate amortization schedule
   */
  generateAmortizationSchedule(principal, monthlyRate, tenureMonths, emi) {
    const schedule = [];
    let balance = principal;
    
    for (let month = 1; month <= tenureMonths; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = emi - interestPayment;
      balance -= principalPayment;
      
      schedule.push({
        month,
        emi: Math.round(emi),
        principal: Math.round(principalPayment),
        interest: Math.round(interestPayment),
        balance: Math.max(0, Math.round(balance))
      });
    }
    
    return schedule;
  }

  /**
   * Get yearly breakdown
   */
  getYearlyBreakdown(schedule) {
    const yearly = [];
    
    for (let year = 0; year < schedule.length / 12; year++) {
      const yearStart = year * 12;
      const yearEnd = Math.min(yearStart + 12, schedule.length);
      const yearSchedule = schedule.slice(yearStart, yearEnd);
      
      yearly.push({
        year: year + 1,
        principalPaid: yearSchedule.reduce((sum, m) => sum + m.principal, 0),
        interestPaid: yearSchedule.reduce((sum, m) => sum + m.interest, 0),
        balance: yearSchedule[yearSchedule.length - 1].balance
      });
    }
    
    return yearly;
  }

  /**
   * Calculate affordability
   */
  calculateAffordability(params) {
    const {
      monthlyIncome,
      existingEMI = 0,
      interestRate = 8.5,
      tenure = 20,
      downPaymentPercentage = 20
    } = params;
    
    // Maximum EMI allowed (typically 40-50% of monthly income)
    const maxEMIPercentage = 0.4;
    const maxEMI = (monthlyIncome * maxEMIPercentage) - existingEMI;
    
    // Calculate maximum loan amount
    const monthlyRate = interestRate / 12 / 100;
    const tenureMonths = tenure * 12;
    
    let maxLoanAmount = 0;
    if (monthlyRate > 0) {
      const compoundFactor = Math.pow(1 + monthlyRate, tenureMonths);
      maxLoanAmount = maxEMI * (compoundFactor - 1) / (monthlyRate * compoundFactor);
    } else {
      maxLoanAmount = maxEMI * tenureMonths;
    }
    
    // Calculate maximum property value
    const maxPropertyValue = maxLoanAmount / (1 - downPaymentPercentage / 100);
    const downPaymentRequired = maxPropertyValue * (downPaymentPercentage / 100);
    
    return {
      monthlyIncome,
      existingEMI,
      maxEMI: Math.round(maxEMI),
      maxLoanAmount: Math.round(maxLoanAmount),
      maxPropertyValue: Math.round(maxPropertyValue),
      downPaymentRequired: Math.round(downPaymentRequired),
      downPaymentPercentage,
      interestRate,
      tenure
    };
  }

  /**
   * Calculate area conversion
   */
  convertArea(params) {
    const { value, fromUnit, toUnit } = params;
    
    // Conversion rates to square feet
    const toSqftRates = {
      sqft: 1,
      sqyrd: 9,
      sqm: 10.7639,
      acre: 43560,
      hectare: 107639,
      ground: 2400,
      cent: 435.6,
      guntha: 1089,
      bigha: 27000 // Approximate, varies by region
    };
    
    // Convert to square feet first
    const valueInSqft = value * (toSqftRates[fromUnit] || 1);
    
    // Convert from square feet to target unit
    const convertedValue = valueInSqft / (toSqftRates[toUnit] || 1);
    
    return {
      original: { value, unit: fromUnit },
      converted: { value: Math.round(convertedValue * 100) / 100, unit: toUnit },
      valueInSqft: Math.round(valueInSqft * 100) / 100
    };
  }

  /**
   * Calculate stamp duty and registration charges
   */
  calculateStampDuty(params) {
    const { propertyValue, state, gender = 'male', isFirstHome = false } = params;
    
    // State-wise stamp duty rates (approximate)
    const stampDutyRates = {
      maharashtra: { male: 6, female: 5 },
      karnataka: { male: 5, female: 5 },
      delhi: { male: 6, female: 4 },
      tamilnadu: { male: 7, female: 7 },
      telangana: { male: 5, female: 5 },
      gujarat: { male: 4.9, female: 4.9 },
      westbengal: { male: 7, female: 5 },
      uttarpradesh: { male: 7, female: 6 },
      haryana: { male: 7, female: 5 },
      default: { male: 6, female: 5 }
    };
    
    const rates = stampDutyRates[state?.toLowerCase()] || stampDutyRates.default;
    const stampDutyRate = rates[gender] || 6;
    
    // Registration charges (typically 1%)
    const registrationRate = 1;
    
    // First home buyer benefits
    let discount = 0;
    if (isFirstHome) {
      discount = 1; // 1% discount
    }
    
    const stampDuty = propertyValue * ((stampDutyRate - discount) / 100);
    const registration = propertyValue * (registrationRate / 100);
    const total = stampDuty + registration;
    
    return {
      propertyValue,
      state,
      stampDutyRate: stampDutyRate - discount,
      stampDuty: Math.round(stampDuty),
      registrationRate,
      registration: Math.round(registration),
      total: Math.round(total)
    };
  }

  /**
   * Calculate rental yield
   */
  calculateRentalYield(params) {
    const { propertyValue, monthlyRent, annualAppreciation = 3 } = params;
    
    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / propertyValue) * 100;
    
    // Estimate expenses (property tax, maintenance, etc.)
    const estimatedExpenses = annualRent * 0.2;
    const netAnnualRent = annualRent - estimatedExpenses;
    const netYield = (netAnnualRent / propertyValue) * 100;
    
    // Calculate ROI over time
    const projections = [];
    let projectedValue = propertyValue;
    
    for (let year = 1; year <= 5; year++) {
      projectedValue = projectedValue * (1 + annualAppreciation / 100);
      const annualRentAdjusted = annualRent * Math.pow(1.03, year - 1);
      const totalReturn = projectedValue - propertyValue + (annualRentAdjusted * year);
      const roi = (totalReturn / propertyValue) * 100;
      
      projections.push({
        year,
        propertyValue: Math.round(projectedValue),
        annualRent: Math.round(annualRentAdjusted),
        cumulativeRent: Math.round(annualRentAdjusted * year),
        totalReturn: Math.round(totalReturn),
        roi: Math.round(roi * 10) / 10
      });
    }
    
    return {
      propertyValue,
      monthlyRent,
      annualRent,
      grossYield: Math.round(grossYield * 10) / 10,
      estimatedExpenses: Math.round(estimatedExpenses),
      netYield: Math.round(netYield * 10) / 10,
      projections
    };
  }

  /**
   * Calculate capital gains tax
   */
  calculateCapitalGains(params) {
    const {
      purchasePrice,
      purchaseYear,
      salePrice,
      saleYear,
      indexation = true,
      improvements = []
    } = params;
    
    // CII (Cost Inflation Index) values - base year 2001-02 = 100
    const ciiValues = {
      2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117,
      2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167,
      2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254,
      2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301,
      2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 378
    };
    
    const holdingPeriod = saleYear - purchaseYear;
    const isLongTerm = holdingPeriod > 2; // For property
    
    let taxableGain = 0;
    let taxAmount = 0;
    
    if (isLongTerm && indexation) {
      const purchaseCII = ciiValues[purchaseYear] || 100;
      const saleCII = ciiValues[saleYear] || 100;
      
      const indexedPurchasePrice = purchasePrice * (saleCII / purchaseCII);
      
      let indexedImprovementsTotal = 0;
      improvements.forEach(imp => {
        const impCII = ciiValues[imp.year] || 100;
        indexedImprovementsTotal += imp.cost * (saleCII / impCII);
      });
      
      const indexedCost = indexedPurchasePrice + indexedImprovementsTotal;
      taxableGain = salePrice - indexedCost;
      taxAmount = taxableGain * 0.20; // 20% LTCG tax
    } else {
      taxableGain = salePrice - purchasePrice - improvements.reduce((sum, i) => sum + i.cost, 0);
      taxAmount = taxableGain * 0.30; // 30% STCG tax (as per income slab)
    }
    
    return {
      purchasePrice,
      purchaseYear,
      salePrice,
      saleYear,
      holdingPeriod,
      isLongTerm,
      capitalGain: Math.round(taxableGain),
      taxRate: isLongTerm ? 20 : 30,
      estimatedTax: Math.round(Math.max(0, taxAmount)),
      notes: isLongTerm 
        ? 'Long-term capital gains (LTCG) tax at 20% with indexation benefit'
        : 'Short-term capital gains (STCG) tax as per income tax slab'
    };
  }
}

module.exports = new CalculatorService();