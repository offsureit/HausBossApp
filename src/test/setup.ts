// Jest setup: keep the API client quiet and deterministic.
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
