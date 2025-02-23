import { describe, expect, it } from 'bun:test';
import { extractId } from './util';

describe('extractId', () => {
  it('should extract ID from a standard YouTube URL', () => {
    expect(extractId('https://www.youtube.com/watch?v=K-2pXMP3uu4')).toBe('K-2pXMP3uu4');
  });

  it('should extract ID from a shortened YouTube URL', () => {
    expect(extractId('https://youtu.be/K-2pXMP3uu4')).toBe('K-2pXMP3uu4');
  });

  it('should extract ID from a YouTube shorts URL', () => {
    expect(extractId('https://www.youtube.com/shorts/xuLfu0z5_m0')).toBe('xuLfu0z5_m0');
  });

  it('should extract ID from a direct ID input', () => {
    expect(extractId('xuLfu0z5_m0')).toBe('xuLfu0z5_m0');
  });

  it('should return null for an invalid URL', () => {
    expect(extractId('https://www.example.com')).toBeNull();
  });

  it('should return null for an empty input', () => {
    expect(extractId('')).toBeNull();
  });

  it('should return null for a null input', () => {
    expect(extractId(null as unknown as string)).toBeNull();
  });
});