import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MusicBrainzService } from './musicbrainz.service';
import { Track } from '../schemas/record.schema';

describe('MusicBrainzService', () => {
  let service: MusicBrainzService;
  let httpService: jest.Mocked<HttpService>;
  let cacheManager: any;
  let logger: jest.SpyInstance;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicBrainzService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<MusicBrainzService>(MusicBrainzService);
    httpService = module.get(HttpService);
    cacheManager = module.get(CACHE_MANAGER);

    // Spy on logger methods
    logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTracklist', () => {
    const validMbid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';
    const baseUrl = 'https://musicbrainz.org/ws/2';
    const expectedUrl = `${baseUrl}/release/${validMbid}?inc=recordings+media`;

    beforeEach(() => {
      // Default: cache miss
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);
    });

    it('should return cached tracklist on cache hit', async () => {
      const cachedTracks: Track[] = [
        { position: 1, title: 'Cached Track', duration: 180000 },
      ];

      cacheManager.get.mockResolvedValue(cachedTracks);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toEqual(cachedTracks);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `musicbrainz:tracklist:${validMbid}`,
      );
      expect(httpService.get).not.toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(`Cache hit for MBID: ${validMbid}`);
    });

    it('should fetch from API on cache miss and cache the result', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Come Together',
                    length: '259000',
                    recording: {
                      title: 'Come Together',
                    },
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      const parseSpy = jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toHaveLength(1);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `musicbrainz:tracklist:${validMbid}`,
      );
      expect(httpService.get).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(
        `musicbrainz:tracklist:${validMbid}`,
        result,
        7 * 24 * 60 * 60 * 1000, // 7 days
      );
      expect(logger).toHaveBeenCalledWith(
        `Cache miss for MBID: ${validMbid}, fetching from MusicBrainz`,
      );

      parseSpy.mockRestore();
    });

    it('should cache 404 responses to avoid repeated calls for invalid MBIDs', async () => {
      const error = {
        response: {
          status: 404,
        },
        message: 'Not Found',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      const result = await service.fetchTracklist('invalid-mbid');

      expect(result).toEqual([]);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'musicbrainz:tracklist:invalid-mbid',
        [],
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it('should not cache transient errors (network issues)', async () => {
      const error = {
        message: 'Network Error',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toEqual([]);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should successfully fetch tracklist with valid MBID', async () => {
      const mockXmlData = `
        <metadata>
          <release>
            <medium-list>
              <medium>
                <track-list>
                  <track position="1">
                    <title>Come Together</title>
                    <length>259000</length>
                    <recording>
                      <title>Come Together</title>
                    </recording>
                  </track>
                </track-list>
              </medium>
            </medium-list>
          </release>
        </metadata>
      `;

      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Come Together',
                    length: '259000',
                    recording: {
                      title: 'Come Together',
                    },
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: mockXmlData }) as any);

      // Mock XMLParser by accessing the private property
      // Since parseTracklist is private, we'll test it through fetchTracklist
      // We need to mock the XMLParser.parse method
      const parseSpy = jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        position: 1,
        title: 'Come Together',
        duration: 259000,
      });
      expect(httpService.get).toHaveBeenCalledWith(expectedUrl, {
        headers: {
          'User-Agent': 'HostelworldChallenge/1.0 (contact@example.com)',
          Accept: 'application/xml',
        },
        timeout: 10000,
      });
      expect(logger).toHaveBeenCalledWith(
        `Successfully fetched 1 tracks for MBID: ${validMbid}`,
      );

      parseSpy.mockRestore();
    });

    it('should call MusicBrainz API with correct URL format', async () => {
      const mockXmlData =
        '<metadata><release><medium-list></medium-list></release></metadata>';
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {},
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: mockXmlData }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      await service.fetchTracklist(validMbid);

      expect(httpService.get).toHaveBeenCalledWith(
        `${baseUrl}/release/${validMbid}?inc=recordings+media`,
        expect.any(Object),
      );
    });

    it('should use correct HTTP headers (User-Agent, Accept)', async () => {
      const mockXmlData =
        '<metadata><release><medium-list></medium-list></release></metadata>';
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {},
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: mockXmlData }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      await service.fetchTracklist(validMbid);

      expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
        headers: {
          'User-Agent': 'HostelworldChallenge/1.0 (contact@example.com)',
          Accept: 'application/xml',
        },
        timeout: 10000,
      });
    });

    it('should set timeout to 10000ms', async () => {
      const mockXmlData =
        '<metadata><release><medium-list></medium-list></release></metadata>';
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {},
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: mockXmlData }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      await service.fetchTracklist(validMbid);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });

    it('should log cache miss and fetch success', async () => {
      const mockXmlData =
        '<metadata><release><medium-list></medium-list></release></metadata>';
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {},
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: mockXmlData }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      await service.fetchTracklist(validMbid);

      expect(logger).toHaveBeenCalledWith(
        `Cache miss for MBID: ${validMbid}, fetching from MusicBrainz`,
      );
      expect(logger).toHaveBeenCalledWith(
        `Successfully fetched 0 tracks for MBID: ${validMbid}`,
      );
    });

    it('should return empty array when MBID is invalid (404 response)', async () => {
      const error = {
        response: {
          status: 404,
        },
        message: 'Not Found',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      const result = await service.fetchTracklist('invalid-mbid');

      expect(result).toEqual([]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Invalid MBID: invalid-mbid - Release not found',
      );
    });

    it('should return empty array on network errors', async () => {
      const error = {
        message: 'Network Error',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toEqual([]);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Failed to fetch tracklist for MBID ${validMbid}: Network Error`,
      );
    });

    it('should return empty array on timeout errors', async () => {
      const error = {
        message: 'timeout of 10000ms exceeded',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      const result = await service.fetchTracklist(validMbid);

      expect(result).toEqual([]);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Failed to fetch tracklist for MBID ${validMbid}: timeout of 10000ms exceeded`,
      );
    });

    it('should log warnings for 404 errors', async () => {
      const error = {
        response: {
          status: 404,
        },
        message: 'Not Found',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      await service.fetchTracklist('invalid-mbid');

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Invalid MBID: invalid-mbid - Release not found',
      );
      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });

    it('should log errors for other failures', async () => {
      const error = {
        message: 'Internal Server Error',
      };

      httpService.get.mockReturnValue(throwError(() => error) as any);

      await service.fetchTracklist(validMbid);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Failed to fetch tracklist for MBID ${validMbid}: Internal Server Error`,
      );
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });
  });

  describe('parseTracklist', () => {
    // Since parseTracklist is private, we test it through fetchTracklist
    // by mocking the HTTP response and verifying the parsed results

    it('should parse XML with single medium and single track', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                    length: '180000',
                    recording: {
                      title: 'Track 1',
                    },
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        position: 1,
        title: 'Track 1',
        duration: 180000,
      });
    });

    it('should parse XML with single medium and multiple tracks', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: [
                    {
                      position: '1',
                      title: 'Track 1',
                      length: '180000',
                      recording: {
                        title: 'Track 1',
                      },
                    },
                    {
                      position: '2',
                      title: 'Track 2',
                      length: '200000',
                      recording: {
                        title: 'Track 2',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        position: 1,
        title: 'Track 1',
        duration: 180000,
      });
      expect(result[1]).toEqual({
        position: 2,
        title: 'Track 2',
        duration: 200000,
      });
    });

    it('should parse XML with multiple mediums', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: [
                {
                  'track-list': {
                    track: {
                      position: '1',
                      title: 'Track 1',
                      length: '180000',
                    },
                  },
                },
                {
                  'track-list': {
                    track: {
                      position: '2',
                      title: 'Track 2',
                      length: '200000',
                    },
                  },
                },
              ],
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        position: 1,
        title: 'Track 1',
        duration: 180000,
      });
      expect(result[1]).toEqual({
        position: 2,
        title: 'Track 2',
        duration: 200000,
      });
    });

    it('should extract track position correctly', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '5',
                    title: 'Track 5',
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].position).toBe(5);
    });

    it('should extract track title from track.title or recording.title', async () => {
      // Test track.title
      const mockParsedData1 = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track Title',
                    recording: {
                      title: 'Recording Title',
                    },
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData1);

      const result1 = await service.fetchTracklist('test-mbid');
      expect(result1[0].title).toBe('Track Title');

      // Test recording.title fallback
      const mockParsedData2 = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    recording: {
                      title: 'Recording Title',
                    },
                  },
                },
              },
            },
          },
        },
      };

      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData2);
      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);

      const result2 = await service.fetchTracklist('test-mbid');
      expect(result2[0].title).toBe('Recording Title');
    });

    it('should use Unknown Track when title is missing', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].title).toBe('Unknown Track');
    });

    it('should extract duration from track.length or recording.length', async () => {
      // Test track.length
      const mockParsedData1 = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                    length: '180000',
                    recording: {
                      length: '200000',
                    },
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData1);

      const result1 = await service.fetchTracklist('test-mbid');
      expect(result1[0].duration).toBe(180000);

      // Test recording.length fallback
      const mockParsedData2 = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                    recording: {
                      length: '200000',
                    },
                  },
                },
              },
            },
          },
        },
      };

      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData2);
      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);

      const result2 = await service.fetchTracklist('test-mbid');
      expect(result2[0].duration).toBe(200000);
    });

    it('should handle missing duration gracefully (undefined)', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].duration).toBeUndefined();
    });

    it('should sort tracks by position', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: [
                    {
                      position: '3',
                      title: 'Track 3',
                    },
                    {
                      position: '1',
                      title: 'Track 1',
                    },
                    {
                      position: '2',
                      title: 'Track 2',
                    },
                  ],
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(3);
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(2);
      expect(result[2].position).toBe(3);
    });

    it('should return empty array when metadata is missing', async () => {
      const mockParsedData = {};

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should return empty array when release is missing', async () => {
      const mockParsedData = {
        metadata: {},
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should return empty array when medium-list is missing', async () => {
      const mockParsedData = {
        metadata: {
          release: {},
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should handle empty track-list gracefully', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {},
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
    });

    it('should handle invalid position values (default to 0)', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: 'invalid',
                    title: 'Track 1',
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].position).toBe(0);
    });

    it('should handle NaN duration values (set to undefined)', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                    length: 'invalid',
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].duration).toBeUndefined();
    });

    it('should return empty array on XML parsing errors', async () => {
      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest.spyOn((service as any).xmlParser, 'parse').mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toEqual([]);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to parse MusicBrainz XML response: Parse error',
      );
    });

    it('should log errors on parsing failures', async () => {
      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest.spyOn((service as any).xmlParser, 'parse').mockImplementation(() => {
        throw new Error('XML parsing failed');
      });

      await service.fetchTracklist('test-mbid');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to parse MusicBrainz XML response: XML parsing failed',
      );
    });

    it('should handle duration as number string', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: {
                'track-list': {
                  track: {
                    position: '1',
                    title: 'Track 1',
                    length: 180000, // Number instead of string
                  },
                },
              },
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result[0].duration).toBe(180000);
    });

    it('should handle multiple mediums with multiple tracks', async () => {
      const mockParsedData = {
        metadata: {
          release: {
            'medium-list': {
              medium: [
                {
                  'track-list': {
                    track: [
                      {
                        position: '1',
                        title: 'Medium 1 Track 1',
                        length: '180000',
                      },
                      {
                        position: '2',
                        title: 'Medium 1 Track 2',
                        length: '200000',
                      },
                    ],
                  },
                },
                {
                  'track-list': {
                    track: [
                      {
                        position: '1',
                        title: 'Medium 2 Track 1',
                        length: '190000',
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      };

      httpService.get.mockReturnValue(of({ data: 'xml' }) as any);
      jest
        .spyOn((service as any).xmlParser, 'parse')
        .mockReturnValue(mockParsedData);

      const result = await service.fetchTracklist('test-mbid');

      expect(result).toHaveLength(3);
      // Should be sorted by position
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });
});
