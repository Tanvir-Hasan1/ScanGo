import { useState, useEffect, useCallback } from 'react';
import { getCards, Card, deleteCard } from '../services/db';

export const useCards = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(() => {
    setLoading(true);
    try {
      const data = getCards(search);
      setCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const removeCard = async (id: number) => {
    try {
      deleteCard(id);
      fetchCards();
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      return false;
    }
  };

  return {
    cards,
    search,
    setSearch,
    loading,
    refresh: fetchCards,
    removeCard,
  };
};
