import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  const generateRandomId = (length = 19) => {
      let result = '';
      result += Math.floor(Math.random() * 9) + 1;
      for (let i = 1; i < length; i++) {
          result += Math.floor(Math.random() * 10);
      }
      return result;
  };

  const generateOpenUdid = () => {
      return 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => {
          return (Math.random() * 16 | 0).toString(16);
      });
  };

  const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      });
  };

  const CONFIG = {
      BASE_URL: "https://api.tmtreader.com",
      HEADERS: {
          "Host": "api.tmtreader.com",
          "Accept": "application/json; charset=utf-8,application/x-protobuf",
          "X-Xs-From-Web": "false",
          "Age-Range": "8",
          "Sdk-Version": "2",
          "Passport-Sdk-Version": "50357",
          "X-Vc-Bdturing-Sdk-Version": "2.2.1.i18n",
          "User-Agent": "ScRaPe/9.9 (KaliLinux; Nusantara Os; My/Shannz)"
      },
      COMMON_PARAMS: {
          "iid": generateRandomId(19),
          "device_id": generateRandomId(19),
          "ac": "wifi",
          "channel": "gp",
          "aid": "645713",
          "app_name": "Melolo",
          "version_code": "49819",
          "version_name": "4.9.8",
          "device_platform": "android",
          "os": "android",
          "ssmix": "a",
          "device_type": "ScRaPe",
          "device_brand": "Shannz",
          "language": "in",
          "os_api": "28",
          "os_version": "15",
          "openudid": generateOpenUdid(),
          "manifest_version_code": "49819",
          "resolution": "900*1600",
          "dpi": "320",
          "update_version_code": "49819",
          "current_region": "ID",
          "carrier_region": "ID",
          "app_language": "id",
          "sys_language": "in",
          "app_region": "ID",
          "sys_region": "ID",
          "mcc_mnc": "46002",
          "carrier_region_v2": "460",
          "user_language": "id",
          "time_zone": "Asia/Jakarta",
          "ui_language": "in",
          "cdid": generateUUID(),
      }
  };

  const generateRticket = () => {
      return String(Math.floor(Date.now() * 1000) + Math.floor(Math.random() * 1000));
  };

  const request = async (method, endpoint, params = {}, data = null, customHeaders = {}) => {
      try {
          const url = `${CONFIG.BASE_URL}${endpoint}`;
          const finalParams = {
              ...CONFIG.COMMON_PARAMS,
              ...params,
              "_rticket": generateRticket()
          };
          const config = {
              method,
              url,
              headers: {
                  ...CONFIG.HEADERS,
                  ...customHeaders
              },
              params: finalParams,
              data
          };
          const response = await axios(config);
          return response.data;
      } catch (error) {
          const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
          throw new Error(`Melolo API Error: ${errorMsg}`);
      }
  };

  const melolo = {
      search: async (query, offset = 0, limit = 10) => {
          const endpoint = '/i18n_novel/search/page/v1/';
          const params = {
              "search_source_id": "clks###",
              "IsFetchDebug": "false",
              "offset": offset,
              "cancel_search_category_enhance": "false",
              "query": query,
              "limit": limit,
              "search_id": ""
          };
          const json = await request('GET', endpoint, params);
          const searchData = json?.data?.search_data || [];
          const results = [];
          if (Array.isArray(searchData)) {
              searchData.forEach(section => {
                  if (section.books && Array.isArray(section.books)) {
                      section.books.forEach(book => {
                          results.push({
                              title: book.book_name,
                              book_id: book.book_id,
                              cover: book.thumb_url,
                              author: book.author,
                              sinopsis: book.abstract,
                              status: book.show_creation_status,
                              tags: book.stat_infos || [],
                              total_chapters: book.serial_count || book.last_chapter_index
                          });
                      });
                  }
              });
          }
          return results;
      },
      detail: async (bookId) => {
          if (!bookId) throw new Error("Book ID required");
          const endpoint = '/novel/player/video_detail/v1/';
          const headers = {
              "X-Ss-Stub": "238B6268DE1F0B757306031C76B5397E",
              "Content-Type": "application/json; charset=utf-8"
          };
          const payload = {
              "biz_param": {
                  "detail_page_version": 0,
                  "from_video_id": "",
                  "need_all_video_definition": false,
                  "need_mp4_align": false,
                  "source": 4,
                  "use_os_player": false,
                  "video_id_type": 1
              },
              "series_id": bookId
          };
          const json = await request('POST', endpoint, {}, payload, headers);
          const data = json?.data?.video_data || {};
          let tags = [];
          try {
              if (data.category_schema) {
                  const parsed = JSON.parse(data.category_schema);
                  tags = parsed.map(cat => cat.name);
              }
          } catch (e) {
              console.warn("Gagal parse category_schema");
          }
          const videoList = data.video_list || [];
          const episodes = videoList.map(v => ({
              video_id: v.vid,
              episode: v.vid_index,
              title: v.title,
              duration: v.duration,
              likes: v.digged_count,
              cover: v.cover
          }));
          return {
              book_id: data.series_id_str || bookId,
              title: data.series_title,
              intro: data.series_intro,
              cover: data.series_cover,
              total_episodes: data.episode_cnt,
              tags: tags,
              status: data.series_status === 1 ? "Ongoing" : "Completed",
              episodes: episodes
          };
      },
      stream: async (videoId) => {
          if (!videoId) throw new Error("Video ID required");
          const endpoint = '/novel/player/video_model/v1/';
          const headers = {
              "X-Ss-Stub": "B7FB786F2CAA8B9EFB7C67A524B73AFB",
              "Content-Type": "application/json; charset=utf-8"
          };
          const payload = {
              "biz_param": {
                  "detail_page_version": 0,
                  "device_level": 3,
                  "from_video_id": "",
                  "need_all_video_definition": true,
                  "need_mp4_align": false,
                  "source": 4,
                  "use_os_player": false,
                  "video_id_type": 0,
                  "video_platform": 3
              },
              "video_id": videoId
          };
          const json = await request('POST', endpoint, {}, payload, headers);
          const raw = json?.data || {};
          let result = {
              status: true,
              url: raw.main_url,
              backup_url: raw.backup_url,
              expire_at: raw.expire_time,
              width: raw.video_width,
              height: raw.video_height,
              metadata: {},
              downloads: []
          };
          try {
              if (raw.video_model) {
                  const model = JSON.parse(raw.video_model);
                  const thumbs = model.big_thumbs || [];
                  result.metadata = {
                      id: model.video_id,
                      duration: model.video_duration,
                      thumbnail: thumbs.length > 0 ? thumbs[0].img_url : null
                  };
                  if (model.video_list) {
                      Object.values(model.video_list).forEach(item => {
                          let videoUrl = item.main_url;
                          if (videoUrl && !videoUrl.startsWith('http')) {
                              try {
                                  videoUrl = Buffer.from(videoUrl, 'base64').toString('utf-8');
                              } catch (err) {
                                  console.warn("Gagal decode URL untuk kualitas:", item.definition);
                              }
                          }
                          result.downloads.push({
                              quality: item.definition,
                              size: item.size,
                              fps: item.fps,
                              url: videoUrl
                          });
                      });
                      result.downloads.sort((a, b) => b.size - a.size);
                  }
              }
          } catch (error) {
              console.error("Error parsing video_model:", error.message);
              result.status = false;
              result.error = "Failed to parse detailed video model";
          }
          return result;
      }
  };

  const handler = async (m, {
      conn,
      text,
      usedPrefix,
      command
  }) => {
      const args = text.split(' ');
      const subCommand = args[0]?.toLowerCase();
      const query = args.slice(1).join(' ');

      if (!subCommand) {
          let helpText = `Please use a subcommand.\n\n`;
          helpText += `*Example Usage:*\n`;
          helpText += `• ${usedPrefix + command} search <query>\n`;
          helpText += `• ${usedPrefix + command} detail <id>\n`;
          helpText += `• ${usedPrefix + command} stream <episode_id>\n\n`;
          helpText += `_Example: ${usedPrefix + command} search My Boss_`;
          return conn.sendMessage(m.chat, {
              text: helpText
          }, {
              quoted: m
          });
      }

      if (['search', 'detail', 'stream'].includes(subCommand) && !query) {
          return conn.sendMessage(m.chat, {
              text: `Please provide a query or ID after '${subCommand}'.`
          }, {
              quoted: m
          });
      }

      await conn.sendMessage(m.chat, {
          text: '⏳ Processing, please wait...'
      }, {
          quoted: m
      });

      try {
          switch (subCommand) {
              case 'search': {
                  const results = await melolo.search(query);
                  if (!results || results.length === 0) {
                      return conn.sendMessage(m.chat, {
                          text: `No results found for "${query}".`
                      }, {
                          quoted: m
                      });
                  }

                  let responseText = `*🔍 Search Results for "${query}"*\n\n`;
                  results.slice(0, 10).forEach((item, index) => {
                      responseText += `*${index + 1}. ${item.title}*\n`;
                      responseText += `  Author: ${item.author}\n`;
                      responseText += `  Status: ${item.status}\n`;
                      responseText += `  ID: \`${item.book_id}\`\n\n`;
                  });
                  responseText += `Use *${usedPrefix + command} detail <ID>* to get more details.`;
                  await conn.sendMessage(m.chat, {
                      text: responseText
                  }, {
                      quoted: m
                  });
                  break;
              }

              case 'detail': {
                  console.log(`DEBUG: Query received -> ${query}`);

                  const details = await melolo.detail(query);
                  console.log('DEBUG: Details fetched ->', details);

                  if (!details || !details.title) {
                      console.log('DEBUG: Details not found or invalid');
                      return conn.sendMessage(m.chat, {
                          text: `Could not fetch details for ID "${query}". Please ensure it's a valid Series ID from a search.`
                      }, {
                          quoted: m
                      });
                  }

                  let caption = `*🎬 Drama Details*\n\n`;
                  caption += `*Title:* ${details.title}\n`;
                  caption += `*ID:* ${details.book_id}\n`;
                  caption += `*Status:* ${details.status}\n`;
                  caption += `*Total Episodes:* ${details.total_episodes}\n`;
                  caption += `*Tags:* ${details.tags.join(', ')}\n\n`;
                  caption += `*Synopsis:*\n${details.intro}\n\n`;
                  caption += `*Episodes (${details.episodes.length}):*\n`;

                  const episodeList = details.episodes
                      .map(ep => {
                          return `*Title:* ${details.title}
    - Ep ${ep.episode}
      ID: \`${ep.video_id}\`
      Duration: ${ep.duration} sec
      Likes: ${ep.likes}
  *Tags:* ${details.tags.join(', ')}

  *Synopsis:*
  ${details.intro}
  `;
                      })
                      .join('\n');
                  caption += episodeList;

                  caption += `\n\nUse *${usedPrefix + command} stream <Episode ID>* to download an episode.`;

                  console.log('DEBUG: Caption ready to send');

                  await conn.sendMessage(m.chat, {
                      image: {
                          url: details.cover
                      },
                      caption: caption
                  }, {
                      quoted: m
                  });

                  console.log('DEBUG: Message sent');
                  break;
              }

              case 'stream': {
                  const streamData = await melolo.stream(query);
                  if (!streamData.status || streamData.downloads.length === 0) {
                      return conn.sendMessage(m.chat, {
                          text: `Could not find a downloadable stream for ID "${query}".\nError: ${streamData.error || 'Unknown'}`
                      }, {
                          quoted: m
                      });
                  }

                  const bestQuality = streamData.downloads[0];
                  if (!bestQuality || !bestQuality.url) {
                      return conn.sendMessage(m.chat, {
                          text: 'Failed to extract video URL.'
                      }, {
                          quoted: m
                      });
                  }

                  const caption = `*🎥 Video Download*\n\n*Quality:* ${bestQuality.quality}\n*Size:* ${(bestQuality.size / (1024 * 1024)).toFixed(2)} MB`;

                  await conn.sendMessage(m.chat, {
                      video: {
                          url: bestQuality.url
                      },
                      caption: caption
                  }, {
                      quoted: m
                  });
                  break;
              }

              default: {
                  let helpText = `Invalid subcommand: *${subCommand}*\n\n`;
                  helpText += `*Available Subcommands:*\n`;
                  helpText += `• search\n`;
                  helpText += `• detail\n`;
                  helpText += `• stream\n\n`;
                  helpText += `Use *${usedPrefix + command}* for more examples.`;
                  await conn.sendMessage(m.chat, {
                      text: helpText
                  }, {
                      quoted: m
                  });
                  break;
              }
          }
      } catch (e) {
          console.error(e);
          await conn.sendMessage(m.chat, {
              text: `An error occurred: ${e.message}`
          }, {
              quoted: m
          });
      }
  };

  handler.help = ['search <query>', 'detail <id>', 'stream <id>'];
  handler.tags = ['search']
  handler.category = 'search';
  handler.command = ['melolo'];
  handler.description = 'Search and download short dramas from Melolo.';

  handler.register = true

  handler.limit = true;
  return handler
}

rbRegister("search/melolo", feature)

let handler = (m, ctx) => rbRun("search/melolo", m, ctx)

handler.command = ['melolo']
handler.help = ["search <query>", "detail <id>", "stream <id>"]
handler.tags = ['search']

export default handler
