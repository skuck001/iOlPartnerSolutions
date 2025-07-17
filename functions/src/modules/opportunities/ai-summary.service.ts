import { Opportunity } from '../../types';
import { Timestamp } from 'firebase-admin/firestore';

export class AISummaryService {
  
  async generateExecutiveSummary(opportunity: Opportunity): Promise<string> {
    console.log('🧠 AISummaryService: Starting executive summary generation');
    console.log('📋 Opportunity details:', {
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      activitiesCount: opportunity.activities?.length || 0,
      estimatedValue: opportunity.estimatedDealValue
    });

    // For now, use intelligent mock summaries until we resolve deployment issues
    // TODO: Restore Google AI integration once Cloud Functions are stable
    try {
      console.log('🎯 Generating intelligent summary...');
      const summary = this.generateIntelligentSummary(opportunity);
      console.log('✅ Intelligent summary generated successfully');
      return summary;
    } catch (error) {
      console.error('❌ Error generating intelligent summary:', error);
      console.log('🔄 Falling back to mock summary...');
      const mockSummary = this.generateMockSummary(opportunity);
      console.log('✅ Mock summary generated as fallback');
      return mockSummary;
    }
  }

  private generateIntelligentSummary(opportunity: Opportunity): string {
    console.log('🔍 Analyzing opportunity data for intelligent summary...');
    
    const activities = opportunity.activities || [];
    console.log('📊 Activity analysis:', {
      totalActivities: activities.length,
      activityTypes: activities.map(a => a.type).reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    const recentActivities = activities.filter(activity => {
      const activityDate = activity.dateTime.toDate();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return activityDate > thirtyDaysAgo;
    });
    console.log('📅 Recent activities (last 30 days):', recentActivities.length);

    const completedActivities = recentActivities.filter(a => a.status === 'Completed');
    const scheduledActivities = recentActivities.filter(a => a.status === 'Scheduled');
    
    console.log('📈 Activity status breakdown:', {
      completed: completedActivities.length,
      scheduled: scheduledActivities.length,
      total: recentActivities.length
    });
    
    // Analyze activity types
    const meetingCount = recentActivities.filter(a => a.type === 'Meeting').length;
    const demoCount = recentActivities.filter(a => a.type === 'Demo').length;
    
    console.log('🎯 Activity type analysis:', {
      meetings: meetingCount,
      demos: demoCount
    });
    
    // Generate intelligent summary based on data
    let statusText = '';
    let nextStepText = '';
    
    if (completedActivities.length > 0) {
      if (meetingCount > 0) {
        statusText = `shows strong momentum with ${meetingCount} recent meeting${meetingCount > 1 ? 's' : ''} completed`;
      } else if (demoCount > 0) {
        statusText = `demonstrates progress with ${demoCount} demo session${demoCount > 1 ? 's' : ''} conducted`;
      } else {
        statusText = `maintains active engagement with ${completedActivities.length} recent interaction${completedActivities.length > 1 ? 's' : ''}`;
      }
    } else {
      statusText = 'is in early development phase';
    }
    
    if (scheduledActivities.length > 0) {
      nextStepText = `${scheduledActivities.length} upcoming engagement${scheduledActivities.length > 1 ? 's are' : ' is'} scheduled to advance the partnership`;
    } else {
      nextStepText = 'next engagement should be scheduled to maintain momentum';
    }
    
    const finalSummary = `The ${opportunity.title} opportunity ${statusText}. ${nextStepText}.`;
    console.log('📝 Generated intelligent summary:', {
      length: finalSummary.length,
      preview: finalSummary.substring(0, 80) + '...'
    });
    
    return finalSummary;
  }

  private generateMockSummary(opportunity: Opportunity): string {
    console.log('🎭 Generating mock summary fallback...');
    const recentActivities = opportunity.activities?.length || 0;
    const mockSummary = `The ${opportunity.title} opportunity is progressing with ${recentActivities} activities recorded. Next steps involve continued engagement to advance this partnership forward.`;
    console.log('📝 Mock summary generated:', {
      activitiesCount: recentActivities,
      length: mockSummary.length
    });
    return mockSummary;
  }

  // TODO: Restore this method when Google AI integration is working
  // private buildExecutivePrompt(opportunity: Opportunity): string {
  //   return `Mock prompt for ${opportunity.title}`;
  // }

  /**
   * Check if opportunity needs AI summary update
   */
  static needsAISummaryUpdate(opportunity: Opportunity, hoursThreshold: number = 12): boolean {
    const now = Timestamp.now();
    const thresholdTime = Timestamp.fromMillis(now.toMillis() - (hoursThreshold * 60 * 60 * 1000));

    // Skip if manually requested (will be reset after next auto-run)
    if (opportunity.aiSummaryManuallyRequested) {
      return false;
    }

    // Check if there are new activities since last summary (simplified check)
    const lastSummaryTime = opportunity.aiSummaryGeneratedAt || Timestamp.fromMillis(0);
    const hasNewActivities = (opportunity.activities || []).some(activity => 
      activity.dateTime.toMillis() > lastSummaryTime.toMillis() &&
      activity.dateTime.toMillis() > thresholdTime.toMillis()
    );

    // Or if no summary exists and opportunity has recent activity
    const noRecentSummary = !opportunity.aiSummaryGeneratedAt || 
      opportunity.aiSummaryGeneratedAt.toMillis() < thresholdTime.toMillis();

    return hasNewActivities || (noRecentSummary && (opportunity.activities || []).length > 0);
  }
} 