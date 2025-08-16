import { collection, getDocs, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Service to handle automatic tournament status updates
 */
class TournamentStatusService {
  /**
   * Check and update tournament statuses
   * This function checks all upcoming tournaments and updates their status to 'live'
   * if the tournament start time has been reached
   * 
   * It also checks all live tournaments and updates them to 'completed'
   * if they have been live for more than 10 minutes
   */
  static async checkAndUpdateTournamentStatuses() {
    try {
      // Get all tournaments
      const tournamentsCollection = collection(db, 'tournaments');
      const tournamentsSnapshot = await getDocs(tournamentsCollection);
      const tournaments = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get current date and time
      const now = new Date();
      
      // Filter for upcoming tournaments that should be live
      const upcomingToLive = tournaments.filter(tournament => {
        // Only check upcoming tournaments
        if (tournament.status !== 'upcoming') return false;
        
        // Check if tournament has date and time
        if (!tournament.tournamentDate || !tournament.tournamentTime) return false;
        
        // Convert tournament date and time to Date object
        const tournamentDate = tournament.tournamentDate.toDate();
        const [hours, minutes] = tournament.tournamentTime.split(':').map(Number);
        
        tournamentDate.setHours(hours, minutes, 0, 0);
        
        // Check if tournament start time has passed
        // Add a small buffer (30 seconds) to prevent premature status changes due to clock differences
        const bufferInSeconds = 30; // 30 seconds buffer
        const adjustedNow = new Date(now.getTime() - (bufferInSeconds * 1000)); // Subtract buffer from current time
        
        return adjustedNow >= tournamentDate;
      });
      
      // Filter for live tournaments that should be completed (after 10 minutes)
      const liveToCompleted = tournaments.filter(tournament => {
        // Only check live tournaments
        if (tournament.status !== 'live') return false;
        
        // If tournament doesn't have statusUpdatedAt timestamp, use current time minus 10 minutes
        // This handles existing live tournaments that don't have the timestamp yet
        if (!tournament.statusUpdatedAt) {
          // Add statusUpdatedAt for existing live tournaments
          const tournamentRef = doc(db, 'tournaments', tournament.id);
          updateDoc(tournamentRef, { statusUpdatedAt: serverTimestamp() });
          return false; // Don't complete it yet, wait for the next check
        }
        
        // Get the timestamp when the tournament was set to live
        const liveTimestamp = tournament.statusUpdatedAt.toDate();
        
        // Calculate time difference in minutes
        const diffInMinutes = (now - liveTimestamp) / (1000 * 60);
        
        // Check if tournament has been live for more than 10 minutes
        return diffInMinutes >= 10;
      });
      
      // Update tournaments to live status with timestamp
      const updateToLivePromises = upcomingToLive.map(tournament => {
        const tournamentRef = doc(db, 'tournaments', tournament.id);
        return updateDoc(tournamentRef, { 
          status: 'live',
          statusUpdatedAt: serverTimestamp()
        });
      });
      
      // Update tournaments to completed status
      const updateToCompletedPromises = liveToCompleted.map(tournament => {
        const tournamentRef = doc(db, 'tournaments', tournament.id);
        
        // Log the status change for security audit
        const logRef = doc(collection(db, 'status_change_logs'));
        const logPromise = setDoc(logRef, {
          tournamentId: tournament.id,
          tournamentName: tournament.gameName || 'Unknown',
          previousStatus: 'live',
          newStatus: 'completed',
          changedAt: serverTimestamp(),
          changedBy: 'system',
          reason: 'Auto-completed after 10 minutes of being live'
        });
        
        // Update the tournament status
        const updatePromise = updateDoc(tournamentRef, { 
          status: 'completed',
          statusUpdatedAt: serverTimestamp()
        });
        
        return Promise.all([updatePromise, logPromise]);
      });
      
      // Execute all updates
      await Promise.all([...updateToLivePromises, ...updateToCompletedPromises.flat()]);
      
      return {
        success: true,
        updatedToLiveCount: upcomingToLive.length,
        updatedToCompletedCount: liveToCompleted.length
      };
    } catch (error) {
      console.error('Error updating tournament statuses:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Migrate existing live tournaments to have statusUpdatedAt field
   * This is a one-time migration function to ensure all live tournaments have the statusUpdatedAt field
   */
  static async migrateLiveTournaments() {
    try {
      // Get all tournaments
      const tournamentsCollection = collection(db, 'tournaments');
      const tournamentsSnapshot = await getDocs(tournamentsCollection);
      const tournaments = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter for live tournaments without statusUpdatedAt
      const liveTournamentsToMigrate = tournaments.filter(tournament => 
        tournament.status === 'live' && !tournament.statusUpdatedAt
      );
      
      // Update tournaments with statusUpdatedAt
      const updatePromises = liveTournamentsToMigrate.map(tournament => {
        const tournamentRef = doc(db, 'tournaments', tournament.id);
        return updateDoc(tournamentRef, { statusUpdatedAt: serverTimestamp() });
      });
      
      await Promise.all(updatePromises);
      
      return {
        success: true,
        migratedCount: liveTournamentsToMigrate.length
      };
    } catch (error) {
      console.error('Error migrating live tournaments:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default TournamentStatusService;
