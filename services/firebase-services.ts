import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'lib/local-db';
import { db } from 'lib/local-client';
import IComment from 'types/comment';
import { INotification } from 'types/notification';
import DetailMovie from 'types/detail-movie';
import { IRecentMovie } from 'types/recent-movie';
import MovieCollection from 'types/movie-collection';

/**
 * The app's per-user data: collections, comments, notifications and watch
 * history.
 *
 * This module used to talk to Firestore, and every method carried a
 * `try/catch` that showed a toast and returned a safe default. The store is
 * local now, so the failure modes are different — a full `localStorage` or a
 * blocked origin — but the defensive shape is kept: this is all best-effort
 * data, and none of it should be able to break a page.
 *
 * The collection paths are unchanged (`userMovies`, `movieComments`,
 * `userNotifications`, `recentMovies`), so a viewer's existing local data from
 * an earlier build still reads back.
 */

/** Trim a toast-worthy message out of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const firebaseServices = {
  getMovieCollection: async (userId: string): Promise<MovieCollection[]> => {
    try {
      const snapshot = await getDoc(doc(db, 'userMovies', userId));
      return snapshot.exists() ? ((snapshot.data().movies as MovieCollection[]) ?? []) : [];
    } catch (error) {
      console.warn('getMovieCollection error:', messageOf(error));
      return [];
    }
  },

  getMovieComments: async (movieId: string): Promise<IComment[]> => {
    try {
      const movieCommentsDocRef = doc(db, 'movieComments', movieId);
      const snapshot = await getDoc(movieCommentsDocRef);
      if (!snapshot.exists()) return [];

      const subcollection = collection(db, 'movieComments', movieId, 'comments');
      const q = query(subcollection, orderBy('timeStamp', 'desc'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return [];

      return querySnapshot.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          id: d.id,
          userName: data.userName,
          userId: data.userId,
          userAvata: data.userAvata,
          text: data.text,
          timeStamp: data.timeStamp,
          likes: data.likes,
        } as IComment;
      });
    } catch (error) {
      console.warn('getMovieComments error:', messageOf(error));
      return [];
    }
  },

  addMovieComment: async (movieId: string, newComment: IComment): Promise<IComment> => {
    try {
      const movieCommentsDocRef = doc(db, 'movieComments', movieId);
      const snapshot = await getDoc(movieCommentsDocRef);
      if (!snapshot.exists()) {
        await setDoc(movieCommentsDocRef, { createAt: new Date().toISOString() });
      }

      const subcollection = collection(db, 'movieComments', movieId, 'comments');
      const added = await addDoc(subcollection, newComment as unknown as DocumentData);
      return { id: added.path.split('/').pop(), ...newComment };
    } catch (error) {
      console.warn('addMovieComment error:', messageOf(error));
      return newComment;
    }
  },

  editMovieComment: async (movieId: string, editedCommentText: string, commentId: string) => {
    try {
      await updateDoc(doc(db, 'movieComments', movieId, 'comments', commentId), {
        text: editedCommentText,
      });
    } catch (error) {
      console.warn('editMovieComment error:', messageOf(error));
    }
    return editedCommentText;
  },

  deleteMovieComment: async (movieId: string, commentId: string) => {
    try {
      await deleteDoc(doc(db, 'movieComments', movieId, 'comments', commentId));
    } catch (error) {
      console.warn('deleteMovieComment error:', messageOf(error));
    }
  },

  likeComment: async (movieId: string, userId: string, comment: IComment) => {
    try {
      await updateDoc(doc(db, 'movieComments', movieId, 'comments', comment.id!), {
        likes: arrayUnion(userId),
      });
    } catch (error) {
      console.warn('likeComment error:', messageOf(error));
    }
  },

  unlikeComment: async (movieId: string, userId: string, comment: IComment) => {
    try {
      await updateDoc(doc(db, 'movieComments', movieId, 'comments', comment.id!), {
        likes: arrayRemove(userId),
      });
    } catch (error) {
      console.warn('unlikeComment error:', messageOf(error));
    }
  },

  createNotification: async (user: { id: string; name: string }, comment: IComment, movie: DetailMovie) => {
    try {
      const notification: INotification = {
        type: 'react',
        userCreatedName: user.name,
        userCreatedId: user.id,
        userReciveId: comment.userId,
        userReciveName: comment.userName,
        timestamp: new Date().toString(),
        movieSlug: movie.movie.slug,
        movieId: movie.movie._id,
        read: false,
      };

      const parent = doc(db, 'userNotifications', notification.userReciveId);
      await setDoc(parent, { updateAt: new Date().toISOString() }, { merge: true });
      await addDoc(
        collection(db, 'userNotifications', notification.userReciveId, 'notifications'),
        notification as unknown as DocumentData
      );
    } catch (error) {
      console.warn('createNotification error:', messageOf(error));
    }
  },

  deleteNotification: async (userReciveId: string, userCreatedId: string) => {
    try {
      const notificationId = await firebaseServices.findNotificationByUserCreatedId(
        userReciveId,
        userCreatedId
      );
      if (!notificationId) return;
      await deleteDoc(doc(db, 'userNotifications', userReciveId, 'notifications', notificationId));
    } catch (error) {
      console.warn('deleteNotification error:', messageOf(error));
    }
  },

  findNotificationByUserCreatedId: async (
    userReciveId: string,
    userCreatedId: string
  ): Promise<string | null> => {
    try {
      const q = query(
        collection(db, 'userNotifications', userReciveId, 'notifications'),
        where('userCreatedId', '==', userCreatedId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs[0]?.id ?? null;
    } catch (error) {
      console.warn('findNotificationByUserCreatedId error:', messageOf(error));
      return null;
    }
  },

  readedNotification: async (notification: INotification) => {
    await setDoc(
      doc(db, 'userNotifications', notification.userReciveId, 'notifications', notification.id!),
      { read: true },
      { merge: true }
    );
  },

  // Mark every unread notification for a user as read in one batched write.
  // The active onSnapshot listener pushes the updated docs, so the unread
  // count + list refresh automatically — no manual local-state update needed.
  markAllNotificationsRead: async (userId: string) => {
    try {
      const q = query(
        collection(db, 'userNotifications', userId, 'notifications'),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch (error) {
      console.warn('markAllNotificationsRead error:', messageOf(error));
    }
  },

  listenToUserNotifications: async (
    userId: string,
    handleReciveNotificationData: (notifications: INotification[]) => void
  ) => {
    try {
      const q = query(collection(db, 'userNotifications', userId, 'notifications'));
      return onSnapshot(q, (snapshot) => {
        const notifications: INotification[] = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as DocumentData) }) as INotification
        );
        handleReciveNotificationData(notifications);
      });
    } catch (error) {
      console.warn('listenToUserNotifications error:', messageOf(error));
      return undefined;
    }
  },

  // ─── recentMovies collection ──────────────────────────────────────────────

  /** List all recent-watched entries for a user (unsorted). */
  getRecentMovies: async (userId: string): Promise<IRecentMovie[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'recentMovies', userId, 'movies'));
      if (snapshot.empty) return [];
      return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as IRecentMovie);
    } catch (error) {
      console.warn('getRecentMovies error:', messageOf(error));
      return [];
    }
  },

  /** Fetch one recent-watched entry. Returns null when missing or on error. */
  getRecentMovie: async (userId: string, movieId: string): Promise<IRecentMovie | null> => {
    try {
      const snapshot = await getDoc(doc(db, 'recentMovies', userId, 'movies', movieId));
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...(snapshot.data() as DocumentData) } as IRecentMovie;
    } catch {
      return null;
    }
  },

  /** Delete one recent-watched entry. Returns false on failure (non-fatal). */
  removeRecentMovie: async (userId: string, movieId: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, 'recentMovies', userId, 'movies', movieId));
      return true;
    } catch (error) {
      console.warn('removeRecentMovie error:', messageOf(error));
      return false;
    }
  },

  /** Upsert watch progress. `updatedAt` stamped client-side for numeric sort. */
  updateWatchProgress: async (recentMovie: IRecentMovie, userId: string): Promise<void> => {
    try {
      await setDoc(
        doc(db, 'recentMovies', userId, 'movies', recentMovie.id),
        { ...recentMovie, userId, updatedAt: Date.now() },
        { merge: true }
      );
    } catch (error) {
      console.warn('updateWatchProgress error:', messageOf(error));
    }
  },
};

export default firebaseServices;
