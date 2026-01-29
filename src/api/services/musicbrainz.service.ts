import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { XMLParser } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import { Track } from '../schemas/record.schema';

@Injectable()
export class MusicBrainzService {
  private readonly logger = new Logger(MusicBrainzService.name);
  private readonly baseUrl = 'https://musicbrainz.org/ws/2';
  private readonly userAgent = 'HostelworldChallenge/1.0 (contact@example.com)';
  private readonly xmlParser: XMLParser;

  constructor(private readonly httpService: HttpService) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Fetches tracklist from MusicBrainz API for a given release MBID.
   * Returns an empty array if the MBID is invalid or the API is unavailable.
   */
  async fetchTracklist(mbid: string): Promise<Track[]> {
    try {
      const url = `${this.baseUrl}/release/${mbid}?inc=recordings+media`;

      this.logger.log(`Fetching tracklist from MusicBrainz for MBID: ${mbid}`);

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

      return tracks;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`Invalid MBID: ${mbid} - Release not found`);
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
          const position = parseInt(track.position, 10);

          // Title can be on the track itself or fall back to recording title
          const title = track.title || recording?.title || 'Unknown Track';

          // Duration is in milliseconds, can be on track or recording
          const durationMs =
            track.length || recording?.length
              ? parseInt(track.length || recording?.length, 10)
              : undefined;

          tracks.push({
            position,
            title,
            duration: durationMs,
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
