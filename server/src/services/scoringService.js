/**
 * Deterministic Evidence-Coverage Score Calculation
 * Formula: Coverage = 100 * sum(weight * score) / sum(weight)
 */
export class ScoringService {
  static DEFAULT_CONFIG = {
    requiredWeight: 2.0,
    preferredWeight: 1.0,
    demonstratedScore: 1.0,
    partiallyDemonstratedScore: 0.5,
    notDemonstratedScore: 0.0,
    formula: 'Coverage = 100 * sum(weight * evidence_score) / sum(weight)',
  };

  /**
   * Calculates the deterministic evidence coverage score
   * @param {Array<{ skill: string, classification: 'required' | 'preferred', status: 'demonstrated' | 'partially_demonstrated' | 'not_demonstrated' }>} skillResults
   * @param {Object} [config]
   */
  static calculateCoverage(skillResults, config = ScoringService.DEFAULT_CONFIG) {
    if (!skillResults || skillResults.length === 0) {
      return {
        coverageScore: 0,
        totalWeight: 0,
        weightedEarned: 0,
        config,
        breakdown: [],
        explanation: 'No skill requirements found to score against.',
      };
    }

    let totalWeight = 0;
    let weightedEarned = 0;
    const breakdown = [];

    for (const item of skillResults) {
      const isReq = item.classification === 'required';
      const weight = isReq ? config.requiredWeight : config.preferredWeight;

      let score = config.notDemonstratedScore;
      if (item.status === 'demonstrated') {
        score = config.demonstratedScore;
      } else if (item.status === 'partially_demonstrated') {
        score = config.partiallyDemonstratedScore;
      }

      const earned = weight * score;
      totalWeight += weight;
      weightedEarned += earned;

      breakdown.push({
        skill: item.skill,
        classification: item.classification,
        status: item.status,
        weight,
        score,
        earned,
      });
    }

    const coverageScore = totalWeight > 0 ? Math.round((100 * weightedEarned) / totalWeight) : 0;

    return {
      coverageScore,
      totalWeight,
      weightedEarned,
      config,
      breakdown,
      explanation: `Coverage reflects ${coverageScore}% of job requirements with verifiable code implementation in the analyzed repository. Required skills are weighted at ${config.requiredWeight}x compared to preferred skills at ${config.preferredWeight}x.`,
    };
  }
}
