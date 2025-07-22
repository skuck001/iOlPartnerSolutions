// Removed unused getFirestore import
import { NodesService } from './nodes.service';

export interface DeduplicationConfig {
  entityNameThreshold: number;
  nodeNameThreshold: number;
  websiteDomainWeight: number;
  enableDomainClustering: boolean;
  minConfidenceScore: number;
  maxSuggestions: number;
}

export interface DuplicateMatch {
  target_id: string;
  target_type: 'entity' | 'node' | 'staging';
  target_name: string;
  similarity_score: number;
  match_reasons: string[];
  confidence_level: 'high' | 'medium' | 'low';
  recommended_action: 'merge' | 'review' | 'separate';
}

export interface DeduplicationResult {
  staging_id: string;
  has_duplicates: boolean;
  duplicate_count: number;
  matches: DuplicateMatch[];
  overall_confidence: number;
  suggested_entity_id?: string;
  suggested_merge_action?: 'create_new' | 'merge_existing' | 'manual_review';
}

export class DeduplicationService {
  private nodesService: NodesService;
  
  private readonly defaultConfig: DeduplicationConfig = {
    entityNameThreshold: 0.75,
    nodeNameThreshold: 0.80,
    websiteDomainWeight: 0.9,
    enableDomainClustering: true,
    minConfidenceScore: 0.6,
    maxSuggestions: 5
  };

  constructor() {
    this.nodesService = new NodesService();
  }

  async analyzeDeduplication(
    stagingNodes: any[], 
    userId: string, 
    config: Partial<DeduplicationConfig> = {}
  ): Promise<DeduplicationResult[]> {
    const activeConfig = { ...this.defaultConfig, ...config };
    const results: DeduplicationResult[] = [];

    // Get existing data for comparison
    const existingNodes = await this.nodesService.getNodesByOwner(userId);
    const existingEntities = await this.nodesService.getEntitiesByOwner(userId);

    for (const stagingNode of stagingNodes) {
      const result = await this.analyzeSingleNode(
        stagingNode, 
        existingNodes, 
        existingEntities, 
        activeConfig
      );
      results.push(result);
    }

    return results;
  }

  private async analyzeSingleNode(
    stagingNode: any,
    existingNodes: any[],
    existingEntities: any[],
    config: DeduplicationConfig
  ): Promise<DeduplicationResult> {
    const matches: DuplicateMatch[] = [];

    // 1. Check against existing entities
    const entityMatches = this.findEntityMatches(stagingNode, existingEntities, config);
    matches.push(...entityMatches);

    // 2. Check against existing nodes
    const nodeMatches = this.findNodeMatches(stagingNode, existingNodes, config);
    matches.push(...nodeMatches);

    // 3. Domain-based clustering if enabled
    if (config.enableDomainClustering) {
      const domainMatches = this.findDomainMatches(stagingNode, [...existingNodes, ...existingEntities], config);
      matches.push(...domainMatches);
    }

    // 4. Sort matches by similarity score
    matches.sort((a, b) => b.similarity_score - a.similarity_score);

    // 5. Take top suggestions
    const topMatches = matches.slice(0, config.maxSuggestions);

    // 6. Filter by minimum confidence
    const qualifiedMatches = topMatches.filter(m => m.similarity_score >= config.minConfidenceScore);

    // 7. Calculate overall confidence and suggestions
    const overallConfidence = this.calculateOverallConfidence(qualifiedMatches);
    const suggestedAction = this.determineSuggestedAction(qualifiedMatches, overallConfidence);

    return {
      staging_id: stagingNode.id,
      has_duplicates: qualifiedMatches.length > 0,
      duplicate_count: qualifiedMatches.length,
      matches: qualifiedMatches,
      overall_confidence: overallConfidence,
      suggested_entity_id: this.findBestEntityMatch(qualifiedMatches),
      suggested_merge_action: suggestedAction
    };
  }

  private findEntityMatches(
    stagingNode: any, 
    entities: any[], 
    config: DeduplicationConfig
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const entity of entities) {
      const similarity = this.calculateEntitySimilarity(stagingNode, entity, config);
      
      if (similarity.score >= config.minConfidenceScore) {
        matches.push({
          target_id: entity.entity_id,
          target_type: 'entity',
          target_name: entity.master_entity_name,
          similarity_score: similarity.score,
          match_reasons: similarity.reasons,
          confidence_level: this.getConfidenceLevel(similarity.score),
          recommended_action: this.getRecommendedAction(similarity.score, 'entity')
        });
      }
    }

    return matches;
  }

  private findNodeMatches(
    stagingNode: any, 
    nodes: any[], 
    config: DeduplicationConfig
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const node of nodes) {
      const similarity = this.calculateNodeSimilarity(stagingNode, node, config);
      
      if (similarity.score >= config.minConfidenceScore) {
        matches.push({
          target_id: node.node_id,
          target_type: 'node',
          target_name: `${node.entity_name} - ${node.node_name}`,
          similarity_score: similarity.score,
          match_reasons: similarity.reasons,
          confidence_level: this.getConfidenceLevel(similarity.score),
          recommended_action: this.getRecommendedAction(similarity.score, 'node')
        });
      }
    }

    return matches;
  }

  private findDomainMatches(
    stagingNode: any, 
    allRecords: any[], 
    config: DeduplicationConfig
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    const stagingDomain = this.extractDomain(stagingNode.website || stagingNode.normalized_website);

    if (!stagingDomain) return matches;

    for (const record of allRecords) {
      const recordDomain = this.extractDomain(record.website || record.master_website);
      
      if (recordDomain && stagingDomain === recordDomain) {
        const baseScore = config.websiteDomainWeight;
        const nameScore = record.entity_name ? 
          this.calculateStringSimilarity(stagingNode.entity_name, record.entity_name) : 0;
        
        const combinedScore = (baseScore * 0.7) + (nameScore * 0.3);

        if (combinedScore >= config.minConfidenceScore) {
          matches.push({
            target_id: record.entity_id || record.node_id,
            target_type: record.entity_id ? 'entity' : 'node',
            target_name: record.master_entity_name || record.entity_name || record.node_name,
            similarity_score: combinedScore,
            match_reasons: ['same_domain', nameScore > 0.5 ? 'similar_name' : 'domain_only'],
            confidence_level: this.getConfidenceLevel(combinedScore),
            recommended_action: this.getRecommendedAction(combinedScore, record.entity_id ? 'entity' : 'node')
          });
        }
      }
    }

    return matches;
  }

  private calculateEntitySimilarity(
    stagingNode: any, 
    entity: any, 
    config: DeduplicationConfig
  ): { score: number, reasons: string[] } {
    const reasons: string[] = [];
    let totalScore = 0;
    let weightSum = 0;

    // Entity name similarity (primary factor)
    const nameScore = this.calculateStringSimilarity(
      this.normalizeName(stagingNode.entity_name), 
      this.normalizeName(entity.master_entity_name)
    );
    
    if (nameScore >= config.entityNameThreshold) {
      reasons.push(`entity_name_match_${Math.round(nameScore * 100)}%`);
      totalScore += nameScore * 0.6;
      weightSum += 0.6;
    }

    // Check against alternate names
    if (entity.alternate_names && entity.alternate_names.length > 0) {
      const altNameScores = entity.alternate_names.map((altName: string) =>
        this.calculateStringSimilarity(
          this.normalizeName(stagingNode.entity_name), 
          this.normalizeName(altName)
        )
      );
      const bestAltScore = Math.max(...altNameScores);
      
      if (bestAltScore >= config.entityNameThreshold) {
        reasons.push(`alternate_name_match_${Math.round(bestAltScore * 100)}%`);
        totalScore += bestAltScore * 0.5;
        weightSum += 0.5;
      }
    }

    // Website domain similarity
    const stagingDomain = this.extractDomain(stagingNode.website || stagingNode.normalized_website);
    const entityDomain = this.extractDomain(entity.website || entity.master_website);
    
    if (stagingDomain && entityDomain) {
      if (stagingDomain === entityDomain) {
        reasons.push('exact_domain_match');
        totalScore += config.websiteDomainWeight * 0.4;
        weightSum += 0.4;
      } else {
        const domainSimilarity = this.calculateStringSimilarity(stagingDomain, entityDomain);
        if (domainSimilarity > 0.8) {
          reasons.push(`similar_domain_${Math.round(domainSimilarity * 100)}%`);
          totalScore += domainSimilarity * 0.3;
          weightSum += 0.3;
        }
      }
    }

    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
    return { score: Math.min(1, finalScore), reasons };
  }

  private calculateNodeSimilarity(
    stagingNode: any, 
    existingNode: any, 
    config: DeduplicationConfig
  ): { score: number, reasons: string[] } {
    const reasons: string[] = [];
    let totalScore = 0;
    let weightSum = 0;

    // Node name similarity
    const nodeNameScore = this.calculateStringSimilarity(
      this.normalizeName(stagingNode.node_name), 
      this.normalizeName(existingNode.node_name)
    );
    
    if (nodeNameScore >= config.nodeNameThreshold) {
      reasons.push(`node_name_match_${Math.round(nodeNameScore * 100)}%`);
      totalScore += nodeNameScore * 0.4;
      weightSum += 0.4;
    }

    // Entity name similarity
    const entityNameScore = this.calculateStringSimilarity(
      this.normalizeName(stagingNode.entity_name), 
      this.normalizeName(existingNode.entity_name)
    );
    
    if (entityNameScore >= config.entityNameThreshold) {
      reasons.push(`entity_match_${Math.round(entityNameScore * 100)}%`);
      totalScore += entityNameScore * 0.3;
      weightSum += 0.3;
    }

    // Category and direction match
    if (stagingNode.node_category === existingNode.node_category) {
      reasons.push('same_category');
      totalScore += 0.2;
      weightSum += 0.2;
    }

    if (stagingNode.direction === existingNode.direction) {
      reasons.push('same_direction');
      totalScore += 0.1;
      weightSum += 0.1;
    }

    // Check node aliases
    if (existingNode.node_aliases && existingNode.node_aliases.length > 0) {
      const aliasScores = existingNode.node_aliases.map((alias: string) =>
        this.calculateStringSimilarity(
          this.normalizeName(stagingNode.node_name), 
          this.normalizeName(alias)
        )
      );
      const bestAliasScore = Math.max(...aliasScores);
      
      if (bestAliasScore >= config.nodeNameThreshold) {
        reasons.push(`alias_match_${Math.round(bestAliasScore * 100)}%`);
        totalScore += bestAliasScore * 0.3;
        weightSum += 0.3;
      }
    }

    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
    return { score: Math.min(1, finalScore), reasons };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;

    // Levenshtein distance with normalization
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  private normalizeName(name: string): string {
    if (!name) return '';
    
    return name.toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private extractDomain(url: string): string | null {
    if (!url) return null;
    
    try {
      // Remove protocol
      let domain = url.replace(/^https?:\/\//, '');
      // Remove www
      domain = domain.replace(/^www\./, '');
      // Remove path
      domain = domain.split('/')[0];
      // Remove port
      domain = domain.split(':')[0];
      
      return domain.toLowerCase();
    } catch {
      return null;
    }
  }

  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.9) return 'high';
    if (score >= 0.7) return 'medium';
    return 'low';
  }

  private getRecommendedAction(score: number, type: 'entity' | 'node'): 'merge' | 'review' | 'separate' {
    if (score >= 0.95) return 'merge';
    if (score >= 0.75) return 'review';
    return 'separate';
  }

  private calculateOverallConfidence(matches: DuplicateMatch[]): number {
    if (matches.length === 0) return 1.0; // No conflicts = high confidence

    const avgScore = matches.reduce((sum, match) => sum + match.similarity_score, 0) / matches.length;
    
    // Lower confidence if there are many potential matches
    const penaltyFactor = Math.max(0, 1 - (matches.length * 0.1));
    
    return Math.max(0, Math.min(1, avgScore * penaltyFactor));
  }

  private determineSuggestedAction(
    matches: DuplicateMatch[], 
    overallConfidence: number
  ): 'create_new' | 'merge_existing' | 'manual_review' {
    if (matches.length === 0) return 'create_new';
    
    const hasHighConfidenceMatch = matches.some(m => m.confidence_level === 'high');
    const hasMergeRecommendation = matches.some(m => m.recommended_action === 'merge');
    
    if (hasHighConfidenceMatch && hasMergeRecommendation && overallConfidence > 0.8) {
      return 'merge_existing';
    }
    
    if (overallConfidence < 0.6 || matches.length > 3) {
      return 'manual_review';
    }
    
    return 'manual_review';
  }

  private findBestEntityMatch(matches: DuplicateMatch[]): string | undefined {
    const entityMatches = matches.filter(m => m.target_type === 'entity');
    if (entityMatches.length === 0) return undefined;
    
    // Return the highest scoring entity match
    const bestMatch = entityMatches.reduce((best, current) => 
      current.similarity_score > best.similarity_score ? current : best
    );
    
    return bestMatch.target_id;
  }

  async processDeduplicationDecisions(
    decisions: Array<{
      staging_id: string;
      action: 'approve_new' | 'merge_with_entity' | 'merge_with_node' | 'reject';
      target_id?: string;
      manual_edits?: any;
    }>,
    userId: string
  ): Promise<{ processed: number; errors: any[] }> {
    let processed = 0;
    const errors: any[] = [];

    for (const decision of decisions) {
      try {
        switch (decision.action) {
          case 'approve_new':
            await this.createNewFromStaging(decision.staging_id, decision.manual_edits, userId);
            break;
            
          case 'merge_with_entity':
            if (decision.target_id) {
              await this.mergeWithExistingEntity(decision.staging_id, decision.target_id, decision.manual_edits, userId);
            }
            break;
            
          case 'merge_with_node':
            if (decision.target_id) {
              await this.mergeWithExistingNode(decision.staging_id, decision.target_id, decision.manual_edits, userId);
            }
            break;
            
          case 'reject':
            await this.rejectStagingNode(decision.staging_id, userId);
            break;
        }
        
        processed++;
      } catch (error) {
        errors.push({
          staging_id: decision.staging_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { processed, errors };
  }

  private async createNewFromStaging(stagingId: string, edits: any, userId: string): Promise<void> {
    // Implementation for creating new entity/node from staging data
    // This would call the NodesService to create the final records
  }

  private async mergeWithExistingEntity(stagingId: string, entityId: string, edits: any, userId: string): Promise<void> {
    // Implementation for merging staging data with existing entity
    // Update entity aliases and create new node under existing entity
  }

  private async mergeWithExistingNode(stagingId: string, nodeId: string, edits: any, userId: string): Promise<void> {
    // Implementation for merging staging data with existing node
    // Update node aliases and merge connectivity data
  }

  private async rejectStagingNode(stagingId: string, userId: string): Promise<void> {
    // Mark staging node as rejected
    // Log audit trail
  }
} 