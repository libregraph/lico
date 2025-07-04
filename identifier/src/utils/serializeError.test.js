import { serializeError, createSerializableError } from './serializeError';
import { ExtendedError } from '../errors';

describe('serializeError', () => {
  test('serializes Error objects correctly', () => {
    const error = new Error('Test error');
    const serialized = serializeError(error);
    
    expect(serialized).toEqual({
      message: 'Test error',
      id: 'Test error',
      values: undefined,
      stack: expect.any(String)
    });
  });

  test('serializes ExtendedError objects correctly', () => {
    const error = new ExtendedError('test.error', { param: 'value' });
    const serialized = serializeError(error);
    
    expect(serialized).toEqual({
      message: 'test.error',
      id: 'test.error',
      values: { param: 'value' },
      stack: expect.any(String)
    });
  });

  test('returns null for null input', () => {
    expect(serializeError(null)).toBe(null);
  });

  test('returns plain objects as-is', () => {
    const plainError = { message: 'test', id: 'test.id' };
    expect(serializeError(plainError)).toBe(plainError);
  });
});

describe('createSerializableError', () => {
  test('creates serializable error objects', () => {
    const error = createSerializableError('test.message', { key: 'value' });
    
    expect(error).toEqual({
      message: 'test.message',
      id: 'test.message',
      values: { key: 'value' }
    });
  });

  test('creates error without values', () => {
    const error = createSerializableError('test.message');
    
    expect(error).toEqual({
      message: 'test.message',
      id: 'test.message',
      values: undefined
    });
  });
});