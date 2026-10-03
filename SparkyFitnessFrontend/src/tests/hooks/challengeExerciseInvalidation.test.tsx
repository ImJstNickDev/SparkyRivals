import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useDiaryInvalidation,
  useExerciseInvalidation,
} from '@/hooks/useInvalidateKeys';

it.each([useDiaryInvalidation, useExerciseInvalidation])(
  'reconciles Challenge caches after canonical exercise mutations',
  (useInvalidate) => {
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useInvalidate, { wrapper });
    result.current();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['challenges'] });
    client.clear();
  }
);
