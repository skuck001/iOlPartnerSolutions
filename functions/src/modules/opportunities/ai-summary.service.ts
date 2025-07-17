import { Opportunity } from '../../types';
import { Timestamp } from 'firebase-admin/firestore';

export class AISummaryService {
  
  async generateExecutiveSummary(opportunity: Opportunity): Promise<string> {
    // For now, use intelligent mock summaries until we resolve deployment issues
    // TODO: Restore Google AI integration once Cloud Functions are stable
    try {
      return this.generateIntelligentSummary(opportunity);
    } catch (error) {
      console.error('Error generating summary:', error);
      return this.generateMockSummary(opportunity);
    }
  }

  private generateIntelligentSummary(opportunity: Opportunity): string {
    const activities = opportunity.activities || [];
    const recentActivities = activities.filter(activity => {
      const activityDate = activity.dateTime.toDate();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return activityDate > thirtyDaysAgo;
    });

    const completedActivities = recentActivities.filter(a => a.status === 'Completed');
    const scheduledActivities = recentActivities.filter(a => a.status === 'Scheduled');
    
    // Analyze activity types
    const meetingCount = recentActivities.filter(a => a.type === 'Meeting').length;
    const demoCount = recentActivities.filter(a => a.type === 'Demo').length;
    
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
    
    return `The ${opportunity.title} opportunity ${statusText}. ${nextStepText}.`;
  }

  private generateMockSummary(opportunity: Opportunity): string {
    const recentActivities = opportunity.activities?.length || 0;
    return `The ${opportunity.title} opportunity is progressing with ${recentActivities} activities recorded. Next steps involve continued engagement to advance this partnership forward.`;
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