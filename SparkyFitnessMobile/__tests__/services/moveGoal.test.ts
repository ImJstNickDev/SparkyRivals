const mockRead = jest.fn<Promise<number | null>, []>();
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => ({
    requestAndReadCurrentMoveGoal: () => mockRead(),
  }),
}));
let mockPlatform = 'ios';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
afterEach(() => mockRead.mockReset());
async function load(platform: 'ios' | 'android') {
  mockPlatform = platform;
  let result: typeof import('../../modules/move-goal') | undefined;
  jest.isolateModules(() => {
    result =
      require('../../modules/move-goal') as typeof import('../../modules/move-goal');
  });
  return result!.readAppleMoveGoal();
}
it('reads the Move goal only on explicit invocation', async () => {
  mockRead.mockResolvedValue(450);
  expect(await load('ios')).toBe(450);
  expect(mockRead).toHaveBeenCalledTimes(1);
});
it.each([null, 0, -1, NaN, Infinity])(
  'treats unavailable or invalid Move goal %s as absent',
  async (value) => {
    mockRead.mockResolvedValue(value);
    expect(await load('ios')).toBeNull();
  }
);
it('does not invent a Health Connect goal adapter', async () => {
  expect(await load('android')).toBeNull();
  expect(mockRead).not.toHaveBeenCalled();
});
