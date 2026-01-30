import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { XMLParser } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import { Track } from '../schemas/record.schema';

@Injectable()
export class MusicBrainzService {
  private readonly logger = new Logger(MusicBrainzService.name);
  private readonly baseUrl = 'https://musicbrainz.org/ws/2';
  private readonly userAgent = 'HostelworldChallenge/1.0 (contact@example.com)';
  private readonly xmlParser: XMLParser;

  // Cache TTL for MusicBrainz responses: 7 days (in milliseconds)
  // Album tracklists are immutable, so long TTL is safe
  private readonly MUSICBRAINZ_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  private readonly CACHE_KEY_PREFIX = 'musicbrainz:tracklist:';

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Fetches tracklist from MusicBrainz API for a given release MBID.
   * Results are cached for 7 days since album tracklists are immutable.
   * Returns an empty array if the MBID is invalid or the API is unavailable.
   */
  async fetchTracklist(mbid: string): Promise<Track[]> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${mbid}`;

    // Check cache first
    const cachedTracks = await this.cacheManager.get<Track[]>(cacheKey);
    if (cachedTracks !== undefined && cachedTracks !== null) {
      this.logger.log(`Cache hit for MBID: ${mbid}`);
      return cachedTracks;
    }

    this.logger.log(`Cache miss for MBID: ${mbid}, fetching from MusicBrainz`);

    try {
      const url = `${this.baseUrl}/release/${mbid}?inc=recordings+media`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/xml',
          },
          timeout: 10000,
        }),
      );

      const tracks = this.parseTracklist(response.data);

      this.logger.log(
        `Successfully fetched ${tracks.length} tracks for MBID: ${mbid}`,
      );

      // Cache the result (including empty arrays for valid but trackless releases)
      await this.cacheManager.set(cacheKey, tracks, this.MUSICBRAINZ_CACHE_TTL);

      return tracks;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`Invalid MBID: ${mbid} - Release not found`);
        // Cache 404 responses to avoid repeated calls for invalid MBIDs
        await this.cacheManager.set(cacheKey, [], this.MUSICBRAINZ_CACHE_TTL);
      } else {
        this.logger.error(
          `Failed to fetch tracklist for MBID ${mbid}: ${error.message}`,
        );
      }
      return [];
    }
  }

  /**
   * Parses the XML response from MusicBrainz API and extracts track information.
   */
  private parseTracklist(xmlData: string): Track[] {
    const tracks: Track[] = [];

    try {
      const parsed = this.xmlParser.parse(xmlData);
      const metadata = parsed.metadata;

      if (!metadata?.release) {
        return tracks;
      }

      const release = metadata.release;
      const mediumList = release['medium-list'];

      if (!mediumList?.medium) {
        return tracks;
      }

      // Handle single medium or array of mediums
      const mediums = Array.isArray(mediumList.medium)
        ? mediumList.medium
        : [mediumList.medium];

      for (const medium of mediums) {
        const trackList = medium['track-list'];
        if (!trackList?.track) {
          continue;
        }

        // Handle single track or array of tracks
        const trackArray = Array.isArray(trackList.track)
          ? trackList.track
          : [trackList.track];

        for (const track of trackArray) {
          const recording = track.recording;
          const position = parseInt(track.position, 10) || 0;

          // Title can be on the track itself or fall back to recording title
          const title = track.title || recording?.title || 'Unknown Track';

          // Duration is in milliseconds, can be on track or recording
          const rawLength = track.length ?? recording?.length;
          const durationMs =
            rawLength !== undefined
              ? parseInt(String(rawLength), 10)
              : undefined;

          tracks.push({
            position,
            title,
            duration: Number.isNaN(durationMs) ? undefined : durationMs,
          });
        }
      }

      // Sort by position
      tracks.sort((a, b) => a.position - b.position);
    } catch (error) {
      this.logger.error(
        `Failed to parse MusicBrainz XML response: ${error.message}`,
      );
    }

    return tracks;
  }
}
