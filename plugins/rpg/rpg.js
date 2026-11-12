import { adapt } from '../../lib/engine/plugins.js'
// plugins/dungeon.js
import fs from 'fs'

// Data dungeon disimpan di global.db.dungeon (database/rpg.json): { users, world }
const dg = () => { const d = (global.db.dungeon ||= { users: {}, world: null }); d.users ||= {}; return d }
const saveRpgDb = () => { global.db.dungeon = dg() }
const copy = (o) => JSON.parse(JSON.stringify(o))
const DUNGEON_SIZE = 10 // Increased from 5x5 to 10x10
const MAX_HEALTH = 100
const BASE_DAMAGE = 5
const BASE_DEFENSE = 0
const HELP_RADIUS = 3 // Radius for help calls
const KNOCK_DOWN_TURNS = 3 // Turns before death when knocked down

// Monster dengan HP, damage, dan reward
const MONSTERS = {
  '🐺': { name: 'Serigala', hp: 20, damage: 5, reward: 50, xp: 10 },
  '🦇': { name: 'Kelelawar Vampir', hp: 15, damage: 3, reward: 30, xp: 8 },
  '🐲': { name: 'Naga Kecil', hp: 50, damage: 10, reward: 200, xp: 25 },
  '👹': { name: 'Goblin', hp: 25, damage: 7, reward: 70, xp: 15 },
  '🕷️': { name: 'Laba-laba Raksasa', hp: 18, damage: 6, reward: 45, xp: 12 },
  '💀': { name: 'Skeleton', hp: 22, damage: 6, reward: 60, xp: 14 },
  '🧟': { name: 'Zombie', hp: 30, damage: 4, reward: 65, xp: 16 }
}

// Boss monsters
const BOSSES = {
  '🐉': { name: 'Naga Kuno', hp: 200, damage: 15, reward: 1000, xp: 100 },
  '👿': { name: 'Demon Lord', hp: 250, damage: 20, reward: 1500, xp: 150 },
  '💀': { name: 'Lich King', hp: 300, damage: 25, reward: 2000, xp: 200 },
  '🧙‍♂️': { name: 'Dark Wizard', hp: 180, damage: 30, reward: 1200, xp: 120 }
}

// Item yang bisa ditemukan
const ITEMS = {
  '🗡️': { name: 'Pedang Tajam', type: 'weapon', damage: 5, value: 150 },
  '🔪': { name: 'Belati', type: 'weapon', damage: 3, value: 80 },
  '🪓': { name: 'Kapak', type: 'weapon', damage: 7, value: 200 },
  '⚔️': { name: 'Pedang Legendaris', type: 'weapon', damage: 15, value: 1000 },
  '🏹': { name: 'Busur Elf', type: 'weapon', damage: 10, value: 500 },
  '🛡️': { name: 'Perisai', type: 'armor', defense: 3, value: 120 },
  '🧥': { name: 'Jubah Kulit', type: 'armor', defense: 2, value: 90 },
  '⛑️': { name: 'Helm Besi', type: 'armor', defense: 4, value: 140 },
  '🥼': { name: 'Baju Zirah', type: 'armor', defense: 8, value: 400 },
  '👑': { name: 'Mahkota Pelindung', type: 'armor', defense: 12, value: 800 },
  '🧪': { name: 'Ramuan Penyembuh', type: 'potion', heal: 30, value: 50 },
  '🍖': { name: 'Daging', type: 'food', heal: 15, value: 25 },
  '': { name: 'Apel Ajaib', type: 'food', heal: 50, value: 100 },
  '📜': { name: 'Gulungan Kebangkitan', type: 'revival', value: 300 }
}

// Harta karun
const TREASURES = {
  '💰': { name: 'Kantong Emas', value: 100 },
  '💎': { name: 'Permata', value: 300 },
  '👑': { name: 'Mahkota', value: 500 },
  '📜': { name: 'Gulungan Kuno', value: 250 },
  '🏆': { name: 'Piala Emas', value: 800 },
  '💍': { name: 'Cincin Kekuasaan', value: 1000 }
}

// Arah gerakan
const DIRECTIONS = ['north', 'east', 'south', 'west']
const DIRECTION_EMOJI = {
  'north': '⬆️',
  'east': '➡️',
  'south': '⬇️',
  'west': '⬅️'
}

// Tipe ruangan
const ROOM_TYPES = ['monster', 'treasure', 'empty', 'item', 'boss']
const ROOM_WEIGHTS = [0.35, 0.25, 0.25, 0.1, 0.05] // Added boss rooms

// Fungsi untuk delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Load dungeon data
function loadDungeon() {
  if (!dg().world) {
    // Initialize with empty dungeon
    dg().world = {
      map: generateDungeon(),
      players: {}
    }
    saveRpgDb()
  }
  return copy(dg().world)
}

// Save dungeon data
function saveDungeon(data) {
  dg().world = data
  saveRpgDb()
}

let handler = async (m, { conn, args, command, text }) => {
  // Load user data
  let users = loadUsers()
  const sender = m.sender.split('@')[0]

  // Initialize user if not exists
  if (!users[sender]) {
    users[sender] = {
      balance: 0,
      dungeons: {}
    }
    saveUsers(users)
  }

  // Initialize dungeon data if not exists
  if (!users[sender].dungeons) {
    users[sender].dungeons = {}
    saveUsers(users)
  }

  // Load global dungeon data
  let dungeonData = loadDungeon()

  // Command handler
  try {
    const subCommand = args[0]?.toLowerCase()

    // Start a new dungeon
    if (subCommand === 'start') {
      // Check if player is already in a dungeon
      if (users[sender].dungeons.active) {
        return m.reply(`⚠️ Kamu sudah berada dalam dungeon! Gunakan .dungeon exit untuk keluar.`)
      }

      // Get username
      const username = args[1]
      if (!username) {
        return m.reply(`⚠️ Masukkan username untuk karakter kamu! Contoh: .dungeon start HeroKu`)
      }

      // Initialize player stats
      users[sender].dungeons = {
        active: true,
        username: username,
        position: { x: 0, y: 0 }, // Start at top-left
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        level: users[sender].dungeons.level || 1,
        xp: users[sender].dungeons.xp || 0,
        xpToNextLevel: users[sender].dungeons.xpToNextLevel || 100,
        gold: 0,
        inventory: users[sender].dungeons.inventory || [],
        equippedWeapon: users[sender].dungeons.equippedWeapon || null,
        equippedArmor: users[sender].dungeons.equippedArmor || null,
        visitedRooms: { '0,0': true }, // Mark starting room as visited
        knockedDown: false,
        knockDownTurns: 0
      }

      // Register player in global dungeon
      dungeonData.players[sender] = {
        username: username,
        position: { x: 0, y: 0 },
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        level: users[sender].dungeons.level
      }

      saveUsers(users)
      saveDungeon(dungeonData)

      // Get current room
      const currentRoom = dungeonData.map[0][0]
      users[sender].dungeons.currentRoom = currentRoom

      // Show welcome message and first room
      await conn.sendMessage(m.chat, {
        text: `🧭 *DUNGEON CRAWLER MULTIPLAYER* 🧭\n\n` +
              `Selamat datang, ${username}!\n` +
              `Kamu memasuki dungeon yang gelap dan berbahaya...\n` +
              `Gunakan .dungeon move [arah] untuk bergerak.\n` +
              `Gunakan .dungeon help untuk bantuan.\n\n` +
              describeRoom(users[sender].dungeons, dungeonData, sender)
      })

      // Notify other players in the same room
      await notifyPlayersInSameRoom(conn, sender, dungeonData, `🔔 *PLAYER BARU!* 🔔\n\n${username} memasuki dungeon dan berada di ruangan yang sama denganmu!`)

      return
    }

    // Check if player is in a dungeon
    if (!users[sender].dungeons.active) {
      return m.reply(`⚠️ Kamu belum memulai petualangan! Gunakan .dungeon start [username] untuk memulai.`)
    }

    // Check if player is knocked down
    if (users[sender].dungeons.knockedDown) {
      if (subCommand !== 'use' && subCommand !== 'status' && subCommand !== 'inventory' && subCommand !== 'help' && subCommand !== 'chat') {
        return m.reply(`⚠️ Kamu sedang tergeletak tak berdaya! Gunakan ramuan penyembuh atau tunggu bantuan. ${users[sender].dungeons.knockDownTurns} giliran tersisa sebelum mati.`)
      }
    }

    // Chat command - NEW FEATURE
    if (subCommand === 'chat') {
      const message = args.slice(1).join(' ')

      if (!message) {
        return m.reply(`⚠️ Masukkan pesan yang ingin disampaikan! Contoh: .dungeon chat Halo semua!`)
      }

      const dungeon = users[sender].dungeons

      // Get players in the same room
      const playersInRoom = getPlayersInSameRoom(sender, dungeonData)

      if (playersInRoom.length === 0) {
        return m.reply(`⚠️ Tidak ada pemain lain di ruangan ini untuk diajak chat.`)
      }

      // Send chat message to all players in the room
      for (const player of playersInRoom) {
        try {
          await conn.sendMessage(player.id + '@s.whatsapp.net', {
            text: `💬 *CHAT DARI ${dungeon.username}* 💬\n\n` +
                  `"${message}"\n\n` +
                  `Lokasi: (${dungeon.position.x}, ${dungeon.position.y})\n` +
                  `Balas dengan .dungeon chat [pesan] untuk membalas.`
          })
        } catch (error) {
          console.error('Error sending chat message:', error)
        }
      }

      await conn.sendMessage(m.chat, {
        text: `💬 Pesan kamu telah dikirim ke ${playersInRoom.length} pemain di ruangan ini.`
      })

      return
    }

    // Move command
    if (subCommand === 'move') {
      const direction = args[1]?.toLowerCase()

      if (!direction || !DIRECTIONS.includes(direction)) {
        return m.reply(`⚠️ Arah tidak valid! Gunakan: north, east, south, atau west.`)
      }

      // Check if movement is possible
      const { x, y } = users[sender].dungeons.position
      let newX = x
      let newY = y

      switch (direction) {
        case 'north': newY = Math.max(0, y - 1); break
        case 'south': newY = Math.min(DUNGEON_SIZE - 1, y + 1); break
        case 'west': newX = Math.max(0, x - 1); break
        case 'east': newX = Math.min(DUNGEON_SIZE - 1, x + 1); break
      }

      // Check if position changed (hit a wall)
      if (newX === x && newY === y) {
        return m.reply(`🧱 Kamu menabrak dinding! Tidak bisa bergerak ke arah ${direction}.`)
      }

      // Update position
      users[sender].dungeons.position = { x: newX, y: newY }
      dungeonData.players[sender].position = { x: newX, y: newY }

      // Mark room as visited
      users[sender].dungeons.visitedRooms[`${newX},${newY}`] = true

      // Get new room
      users[sender].dungeons.currentRoom = dungeonData.map[newY][newX]

      saveUsers(users)
      saveDungeon(dungeonData)

      // Describe the new room
      await conn.sendMessage(m.chat, {
        text: `${DIRECTION_EMOJI[direction]} Kamu bergerak ke ${direction}.\n\n` +
              describeRoom(users[sender].dungeons, dungeonData, sender)
      })

      // Notify other players in the same room
      await notifyPlayersInSameRoom(conn, sender, dungeonData, `🔔 *PLAYER BARU DI RUANGAN!* 🔔\n\n${users[sender].dungeons.username} memasuki ruangan ini!\n\nGunakan .dungeon chat [pesan] untuk mengobrol dengannya.`)

      return
    }

    // Attack command
    if (subCommand === 'attack') {
      const dungeon = users[sender].dungeons
      const room = dungeon.currentRoom

      // Check if room has monster or boss
      if ((room.type !== 'monster' && room.type !== 'boss') || room.cleared) {
        return m.reply(`⚠️ Tidak ada monster untuk diserang di ruangan ini!`)
      }

      // Calculate damage
      const weaponDamage = dungeon.equippedWeapon ? ITEMS[dungeon.equippedWeapon].damage : 0
      const playerDamage = BASE_DAMAGE + weaponDamage

      const target = room.type === 'boss' ? room.boss : room.monster

      // Deal damage to monster/boss
      target.hp -= playerDamage

      // Check if monster/boss is defeated
      if (target.hp <= 0) {
        // Monster/boss defeated
        room.cleared = true
        dungeon.gold += target.reward

        // Add XP
        dungeon.xp += target.xp

        // Check for level up
        if (dungeon.xp >= dungeon.xpToNextLevel) {
          dungeon.level += 1
          dungeonData.players[sender].level = dungeon.level
          dungeon.xp -= dungeon.xpToNextLevel
          dungeon.xpToNextLevel = Math.floor(dungeon.xpToNextLevel * 1.5)
          dungeon.maxHealth += 10
          dungeon.health = dungeon.maxHealth
          dungeonData.players[sender].maxHealth = dungeon.maxHealth
          dungeonData.players[sender].health = dungeon.health

          await conn.sendMessage(m.chat, {
            text: `🎉 *LEVEL UP!* 🎉\n\n` +
                  `Kamu naik ke level ${dungeon.level}!\n` +
                  `Max HP +10\n` +
                  `HP dipulihkan sepenuhnya!`
          })
        }

        saveUsers(users)
        saveDungeon(dungeonData)

        // Special message for boss
        if (room.type === 'boss') {
          await conn.sendMessage(m.chat, {
            text: `⚔️ Kamu menyerang ${target.emoji} ${target.name} dan menyebabkan ${playerDamage} damage!\n\n` +
                  `🎯 *BOSS DIKALAHKAN!* 🎯\n` +
                  `${target.emoji} ${target.name} telah dikalahkan!\n` +
                  `💰 Mendapatkan ${target.reward} gold\n` +
                  `Mendapatkan ${target.xp} XP\n\n` +
                  describeRoom(dungeon, dungeonData, sender)
          })

          // Notify all players about boss defeat
          for (const playerId in dungeonData.players) {
            if (playerId !== sender) {
              try {
                await conn.sendMessage(playerId + '@s.whatsapp.net', {
                  text: `*KABAR DUNGEON*\n\n` +
                        `${dungeon.username} telah mengalahkan boss ${target.emoji} ${target.name}!`
                })
              } catch (error) {
                console.error('Error sending notification:', error)
              }
            }
          }
        } else {
          await conn.sendMessage(m.chat, {
            text: `⚔️ Kamu menyerang ${target.emoji} ${target.name} dan menyebabkan ${playerDamage} damage!\n\n` +
                  `🎯 ${target.emoji} ${target.name} dikalahkan!\n` +
                  `💰 Mendapatkan ${target.reward} gold\n` +
                  `Mendapatkan ${target.xp} XP\n\n` +
                  describeRoom(dungeon, dungeonData, sender)
          })
        }

        return
      }

      // Monster/boss still alive, counter attack
      const armorDefense = dungeon.equippedArmor ? ITEMS[dungeon.equippedArmor].defense : 0
      const monsterDamage = Math.max(1, target.damage - BASE_DEFENSE - armorDefense)

      dungeon.health -= monsterDamage
      dungeonData.players[sender].health = dungeon.health

      // Check if player is knocked down
      if (dungeon.health <= 0) {
        // Player knocked down
        dungeon.knockedDown = true
        dungeon.knockDownTurns = KNOCK_DOWN_TURNS
        dungeonData.players[sender].knockedDown = true

        saveUsers(users)
        saveDungeon(dungeonData)

        await conn.sendMessage(m.chat, {
          text: `⚔️ Kamu menyerang ${target.emoji} ${target.name} dan menyebabkan ${playerDamage} damage!\n\n` +
                `💥 ${target.emoji} ${target.name} menyerangmu dan menyebabkan ${monsterDamage} damage!\n\n` +
                `💀 *KAMU TERGELETAK TAK BERDAYA!* 💀\n` +
                `Kamu memiliki ${KNOCK_DOWN_TURNS} giliran untuk menggunakan ramuan penyembuh atau mendapat bantuan sebelum mati.\n` +
                `Gunakan .dungeon tolong untuk memanggil bantuan dari pemain lain!`
        })

        return
      }

      saveUsers(users)
      saveDungeon(dungeonData)

      await conn.sendMessage(m.chat, {
        text: `⚔️ Kamu menyerang ${target.emoji} ${target.name} dan menyebabkan ${playerDamage} damage!\n\n` +
              `💥 ${target.emoji} ${target.name} menyerangmu dan menyebabkan ${monsterDamage} damage!\n\n` +
              `${target.emoji} HP: ${target.hp}\n` +
              `❤️ HP Kamu: ${dungeon.health}/${dungeon.maxHealth}`
      })

      return
    }

    // Take command (for treasures and items)
    if (subCommand === 'take') {
      const dungeon = users[sender].dungeons
      const room = dungeon.currentRoom

      // Check if room has treasure or item
      if ((room.type !== 'treasure' && room.type !== 'item') || room.cleared) {
        return m.reply(`⚠️ Tidak ada yang bisa diambil di ruangan ini!`)
      }

      if (room.type === 'treasure') {
        // Take treasure
        dungeon.gold += room.treasure.value
        room.cleared = true

        saveUsers(users)
        saveDungeon(dungeonData)

        await conn.sendMessage(m.chat, {
          text: `💰 Kamu mengambil ${room.treasure.emoji} ${room.treasure.name}!\n` +
                `Mendapatkan ${room.treasure.value} gold.\n\n` +
                describeRoom(dungeon, dungeonData, sender)
        })

        return
      } else if (room.type === 'item') {
        // Take item
        dungeon.inventory.push(room.item.emoji)
        room.cleared = true

        saveUsers(users)
        saveDungeon(dungeonData)

        await conn.sendMessage(m.chat, {
          text: `🎒 Kamu mengambil ${room.item.emoji} ${room.item.name}!\n\n` +
                describeRoom(dungeon, dungeonData, sender)
        })

        return
      }
    }

    // Use potion/food
    if (subCommand === 'use') {
      const itemEmoji = args[1]

      if (!itemEmoji) {
        return m.reply(`⚠️ Tentukan item yang ingin digunakan! Contoh: .dungeon use 🧪`)
      }

      const dungeon = users[sender].dungeons

      // Check if player has the item
      const itemIndex = dungeon.inventory.indexOf(itemEmoji)

      if (itemIndex === -1) {
        return m.reply(`⚠️ Kamu tidak memiliki item ${itemEmoji} dalam inventory!`)
      }

      // Check if item is usable
      if (!ITEMS[itemEmoji]) {
        return m.reply(`⚠️ Item ${itemEmoji} tidak dikenali!`)
      }

      const item = ITEMS[itemEmoji]

      // Handle different item types
      if (item.type === 'potion' || item.type === 'food') {
        // Healing items
        const healAmount = item.heal

        // Remove from inventory
        dungeon.inventory.splice(itemIndex, 1)

        // Heal player and remove knocked down status if applicable
        dungeon.health = Math.min(dungeon.maxHealth, dungeon.health + healAmount)
        dungeonData.players[sender].health = dungeon.health

        if (dungeon.knockedDown && dungeon.health > 0) {
          dungeon.knockedDown = false
          dungeon.knockDownTurns = 0
          dungeonData.players[sender].knockedDown = false
        }

        saveUsers(users)
        saveDungeon(dungeonData)

        await conn.sendMessage(m.chat, {
          text: `🧪 Kamu menggunakan ${itemEmoji} ${item.name}.\n` +
                `❤️ HP dipulihkan sebanyak ${healAmount}.\n` +
                `❤️ HP Kamu: ${dungeon.health}/${dungeon.maxHealth}` +
                (dungeon.knockedDown ? "" : "\n\n✅ Kamu berhasil bangkit kembali!")
        })

        return
      } else if (item.type === 'revival') {
        // Revival scrolls can only be used on knocked down players
        if (!dungeon.knockedDown) {
          return m.reply(`⚠️ Item ${itemEmoji} ${item.name} hanya bisa digunakan saat tergeletak tak berdaya!`)
        }

        // Remove from inventory
        dungeon.inventory.splice(itemIndex, 1)

        // Revive player
        dungeon.health = Math.floor(dungeon.maxHealth * 0.5) // Revive with 50% HP
        dungeon.knockedDown = false
        dungeon.knockDownTurns = 0
        dungeonData.players[sender].health = dungeon.health
        dungeonData.players[sender].knockedDown = false

        saveUsers(users)
        saveDungeon(dungeonData)

        await conn.sendMessage(m.chat, {
          text: `📜 Kamu menggunakan ${itemEmoji} ${item.name}.\n` +
                `Kekuatan magis menyelimutimu dan memulihkan hidupmu!\n` +
                `❤️ HP dipulihkan menjadi ${dungeon.health}/${dungeon.maxHealth}\n\n` +
                `✅ Kamu berhasil bangkit kembali!`
        })

        return
      } else {
        return m.reply(`⚠️ Item ${itemEmoji} tidak bisa digunakan! Hanya potion, makanan, dan gulungan kebangkitan yang bisa digunakan.`)
      }
    }

    // Equip weapon/armor
    if (subCommand === 'equip') {
      const itemEmoji = args[1]

      if (!itemEmoji) {
        return m.reply(`⚠️ Tentukan item yang ingin diequip! Contoh: .dungeon equip 🗡️`)
      }

      const dungeon = users[sender].dungeons

      // Check if player has the item
      const itemIndex = dungeon.inventory.indexOf(itemEmoji)

      if (itemIndex === -1) {
        return m.reply(`⚠️ Kamu tidak memiliki item ${itemEmoji} dalam inventory!`)
      }

      // Check if item is equippable
      if (!ITEMS[itemEmoji] || (ITEMS[itemEmoji].type !== 'weapon' && ITEMS[itemEmoji].type !== 'armor')) {
        return m.reply(`⚠️ Item ${itemEmoji} tidak bisa diequip! Hanya senjata dan armor yang bisa diequip.`)
      }

      const item = ITEMS[itemEmoji]

      // Equip the item
      if (item.type === 'weapon') {
        // Unequip current weapon if any
        if (dungeon.equippedWeapon) {
          dungeon.inventory.push(dungeon.equippedWeapon)
        }

        dungeon.equippedWeapon = itemEmoji
      } else if (item.type === 'armor') {
        // Unequip current armor if any
        if (dungeon.equippedArmor) {
          dungeon.inventory.push(dungeon.equippedArmor)
        }

        dungeon.equippedArmor = itemEmoji
      }

      // Remove from inventory
      dungeon.inventory.splice(itemIndex, 1)

      saveUsers(users)

      await conn.sendMessage(m.chat, {
        text: `🎽 Kamu mengequip ${itemEmoji} ${item.name}.\n\n` +
              `${item.type === 'weapon' ? `⚔️ Damage +${item.damage}` : `🛡️ Defense +${item.defense}`}`
      })

      return
    }

    // Check inventory
    if (subCommand === 'inventory' || subCommand === 'inv') {
      const dungeon = users[sender].dungeons

      // Count items
      const itemCounts = {}
      dungeon.inventory.forEach(item => {
        itemCounts[item] = (itemCounts[item] || 0) + 1
      })

      // Format inventory
      let inventoryText = `🎒 *INVENTORY* 🎒\n\n`

      if (Object.keys(itemCounts).length === 0) {
        inventoryText += `Inventory kosong.\n`
      } else {
        for (const [emoji, count] of Object.entries(itemCounts)) {
          const item = ITEMS[emoji]
          if (!item) continue // Skip unknown items

          inventoryText += `${emoji} ${item.name} (${count}x)\n`

          if (item.type === 'weapon') {
            inventoryText += `   ⚔️ Damage +${item.damage}\n`
          } else if (item.type === 'armor') {
            inventoryText += `   🛡️ Defense +${item.defense}\n`
          } else if (item.type === 'potion' || item.type === 'food') {
            inventoryText += `   ❤️ Heal +${item.heal}\n`
          } else if (item.type === 'revival') {
            inventoryText += `   🔄 Efek: Kebangkitan\n`
          }

          inventoryText += `   💰 Nilai: ${item.value} gold\n`
        }
      }

      // Show equipped items
      inventoryText += `\n⚔️ *EQUIPPED* ⚔️\n`

      if (dungeon.equippedWeapon) {
        const weapon = ITEMS[dungeon.equippedWeapon]
        inventoryText += `Senjata: ${dungeon.equippedWeapon} ${weapon.name} (+${weapon.damage} damage)\n`
      } else {
        inventoryText += `Senjata: -\n`
      }

      if (dungeon.equippedArmor) {
        const armor = ITEMS[dungeon.equippedArmor]
        inventoryText += `Armor: ${dungeon.equippedArmor} ${armor.name} (+${armor.defense} defense)\n`
      } else {
        inventoryText += `Armor: -\n`
      }

      // Show gold
      inventoryText += `\n💰 Gold: ${dungeon.gold}`

      await conn.sendMessage(m.chat, { text: inventoryText })

      return
    }

    // Check status
    if (subCommand === 'status' || subCommand === 'stat') {
      const dungeon = users[sender].dungeons

      const statusText = `📊 *STATUS* 📊\n\n` +
                         `👤 Username: ${dungeon.username}\n` +
                         `❤️ HP: ${dungeon.health}/${dungeon.maxHealth}\n` +
                         `⭐ Level: ${dungeon.level}\n` +
                         `XP: ${dungeon.xp}/${dungeon.xpToNextLevel}\n` +
                         `💰 Gold: ${dungeon.gold}\n\n` +
                         `⚔️ Base Damage: ${BASE_DAMAGE}\n` +
                         `🛡️ Base Defense: ${BASE_DEFENSE}\n\n` +
                         `🗺️ Posisi: (${dungeon.position.x}, ${dungeon.position.y})\n` +
                         `🔍 Ruangan yang ditemukan: ${Object.keys(dungeon.visitedRooms).length}/${DUNGEON_SIZE * DUNGEON_SIZE}` +
                         (dungeon.knockedDown ? `\n\n⚠️ Status: Tergeletak (${dungeon.knockDownTurns} giliran tersisa)` : "")

      await conn.sendMessage(m.chat, { text: statusText })

      return
    }

    // Show map
    if (subCommand === 'map') {
      const dungeon = users[sender].dungeons

      let mapText = `🗺️ *PETA DUNGEON* 🗺️\n\n`

      for (let y = 0; y < DUNGEON_SIZE; y++) {
        let row = ''
        for (let x = 0; x < DUNGEON_SIZE; x++) {
          const isCurrentPos = dungeon.position.x === x && dungeon.position.y === y
          const isVisited = dungeon.visitedRooms[`${x},${y}`]

          // Check if other players are in this room
          let otherPlayersHere = false
          for (const playerId in dungeonData.players) {
            if (playerId !== sender &&
                dungeonData.players[playerId].position.x === x &&
                dungeonData.players[playerId].position.y === y) {
              otherPlayersHere = true
              break
            }
          }

          if (isCurrentPos) {
            row += '🟢' // Current position
          } else if (otherPlayersHere && isVisited) {
            row += '🔵' // Other player
          } else if (isVisited) {
            const room = dungeonData.map[y][x]
            if (room.cleared) {
              row += '⬜' // Cleared room
            } else {
              // Show room type
              switch (room.type) {
                case 'monster': row += '🔴'; break
                case 'boss': row += '🟣'; break
                case 'treasure': row += '🟡'; break
                case 'item': row += '🟠'; break
                case 'empty': row += '⚪'; break
              }
            }
          } else {
            row += '⬛' // Unexplored
          }
        }
        mapText += row + '\n'
      }

      mapText += `\n🟢 Posisi kamu\n` +
                 `🔵 Pemain lain\n` +
                 `🔴 Monster\n` +
                 `🟣 Boss\n` +
                 `🟡 Harta karun\n` +
                 `🟠 Item\n` +
                 `⚪ Ruangan kosong\n` +
                 `⬜ Ruangan yang sudah dibersihkan\n` +
                 `⬛ Belum dijelajahi`

      await conn.sendMessage(m.chat, { text: mapText })

      return
    }

    // Call for help
    if (subCommand === 'tolong') {
      const dungeon = users[sender].dungeons

      // Send help message to nearby players
      let helpSent = false

      for (const playerId in dungeonData.players) {
        if (playerId === sender) continue

        const otherPlayer = dungeonData.players[playerId]
        const distance = Math.abs(otherPlayer.position.x - dungeon.position.x) +
                         Math.abs(otherPlayer.position.y - dungeon.position.y)

        // Check if player is within help radius
        if (distance <= HELP_RADIUS) {
          helpSent = true

          try {
            await conn.sendMessage(playerId + '@s.whatsapp.net', {
              text: `🆘 *PANGGILAN BANTUAN!* 🆘\n\n` +
                    `${dungeon.username} membutuhkan bantuan!\n` +
                    `Posisi: (${dungeon.position.x}, ${dungeon.position.y})\n` +
                    `Jarak dari posisimu: ${distance} langkah\n\n` +
                    `Gunakan .dungeon help-player ${sender} untuk membantunya.`
            })
          } catch (error) {
            console.error('Error sending help message:', error)
          }
        }
      }

      if (helpSent) {
        await conn.sendMessage(m.chat, {
          text: `🆘 Kamu berteriak meminta bantuan!\n` +
                `Pesan bantuan telah dikirim ke pemain yang berada dalam radius ${HELP_RADIUS} langkah.`
        })
      } else {
        await conn.sendMessage(m.chat, {
          text: `🆘 Kamu berteriak meminta bantuan!\n` +
                `Sayangnya tidak ada pemain lain dalam radius ${HELP_RADIUS} langkah.`
        })
      }

      return
    }

    // Help another player
    if (subCommand === 'help-player') {
      const targetId = args[1]

      if (!targetId) {
        return m.reply(`⚠️ Tentukan ID pemain yang ingin dibantu! Contoh: .dungeon help-player 123456789`)
      }

      // Check if target player exists and is knocked down
      if (!dungeonData.players[targetId] || !dungeonData.players[targetId].knockedDown) {
        return m.reply(`⚠️ Pemain tersebut tidak ditemukan atau tidak membutuhkan bantuan!`)
      }

      const dungeon = users[sender].dungeons
      const targetPos = dungeonData.players[targetId].position

      // Check if player is in the same room as target
      if (dungeon.position.x !== targetPos.x || dungeon.position.y !== targetPos.y) {
        return m.reply(`⚠️ Kamu harus berada di ruangan yang sama dengan pemain tersebut untuk membantunya!`)
      }

      // Help the player by reviving them
      try {
        // Load target player data
        let targetUsers = loadUsers()

        if (!targetUsers[targetId] || !targetUsers[targetId].dungeons || !targetUsers[targetId].dungeons.active) {
          return m.reply(`⚠️ Pemain tersebut tidak ditemukan atau tidak aktif!`)
        }

        // Revive target player
        targetUsers[targetId].dungeons.health = Math.floor(targetUsers[targetId].dungeons.maxHealth * 0.3) // Revive with 30% HP
        targetUsers[targetId].dungeons.knockedDown = false
        targetUsers[targetId].dungeons.knockDownTurns = 0

        dungeonData.players[targetId].health = targetUsers[targetId].dungeons.health
        dungeonData.players[targetId].knockedDown = false

        saveUsers(targetUsers)
        saveDungeon(dungeonData)

        // Notify target player
        try {
          await conn.sendMessage(targetId + '@s.whatsapp.net', {
            text: `*BANTUAN DATANG!*\n\n` +
                  `${dungeon.username} telah membantumu bangkit kembali!\n` +
                  `❤️ HP dipulihkan menjadi ${targetUsers[targetId].dungeons.health}/${targetUsers[targetId].dungeons.maxHealth}`
          })
        } catch (error) {
          console.error('Error sending notification to target:', error)
        }

        await conn.sendMessage(m.chat, {
          text: `Kamu membantu ${dungeonData.players[targetId].username} bangkit kembali!\n` +
                `Mereka berterima kasih atas bantuanmu.`
        })
      } catch (error) {
        console.error('Error helping player:', error)
        return m.reply(`⚠️ Terjadi kesalahan saat membantu pemain tersebut!`)
      }

      return
    }

    // Transfer gold to another player
    if (subCommand === 'transfer') {
      const targetId = args[1]
      const amount = parseInt(args[2])

      if (!targetId || isNaN(amount) || amount <= 0) {
        return m.reply(`⚠️ Format tidak valid! Gunakan: .dungeon transfer [id_player] [jumlah]`)
      }

      // Check if target player exists
      if (!dungeonData.players[targetId]) {
        return m.reply(`⚠️ Pemain tersebut tidak ditemukan!`)
      }

      const dungeon = users[sender].dungeons
      const targetPos = dungeonData.players[targetId].position

      // Check if player is in the same room as target
      if (dungeon.position.x !== targetPos.x || dungeon.position.y !== targetPos.y) {
        return m.reply(`⚠️ Kamu harus berada di ruangan yang sama dengan pemain tersebut untuk transfer gold!`)
      }

      // Check if player has enough gold
      if (dungeon.gold < amount) {
        return m.reply(`⚠️ Gold tidak cukup! Gold kamu: ${dungeon.gold}`)
      }

      try {
        // Load target player data
        let targetUsers = loadUsers()

        if (!targetUsers[targetId] || !targetUsers[targetId].dungeons || !targetUsers[targetId].dungeons.active) {
          return m.reply(`⚠️ Pemain tersebut tidak ditemukan atau tidak aktif!`)
        }

        // Transfer gold
        dungeon.gold -= amount
        targetUsers[targetId].dungeons.gold += amount

        saveUsers(users)
        saveUsers(targetUsers)

        // Notify target player
        try {
          await conn.sendMessage(targetId + '@s.whatsapp.net', {
            text: `💰 *TRANSFER GOLD* 💰\n\n` +
                  `${dungeon.username} mentransfer ${amount} gold kepadamu!\n` +
                  `Gold baru: ${targetUsers[targetId].dungeons.gold}`
          })
        } catch (error) {
          console.error('Error sending notification to target:', error)
        }

        await conn.sendMessage(m.chat, {
          text: `💰 Kamu mentransfer ${amount} gold kepada ${dungeonData.players[targetId].username}.\n` +
                `Gold tersisa: ${dungeon.gold}`
        })
      } catch (error) {
        console.error('Error transferring gold:', error)
        return m.reply(`⚠️ Terjadi kesalahan saat transfer gold!`)
      }

      return
    }

    // Trade item with another player
    if (subCommand === 'trade') {
      const targetId = args[1]
      const itemEmoji = args[2]
      const requestedItemEmoji = args[3]

      if (!targetId || !itemEmoji) {
        return m.reply(`⚠️ Format tidak valid! Gunakan: .dungeon trade [id_player] [emoji_item_kamu] [emoji_item_diminta]`)
      }

      // Check if target player exists
      if (!dungeonData.players[targetId]) {
        return m.reply(`⚠️ Pemain tersebut tidak ditemukan!`)
      }

      const dungeon = users[sender].dungeons
      const targetPos = dungeonData.players[targetId].position

      // Check if player is in the same room as target
      if (dungeon.position.x !== targetPos.x || dungeon.position.y !== targetPos.y) {
        return m.reply(`⚠️ Kamu harus berada di ruangan yang sama dengan pemain tersebut untuk barter!`)
      }

      // Check if player has the item
      const itemIndex = dungeon.inventory.indexOf(itemEmoji)
      if (itemIndex === -1) {
        return m.reply(`⚠️ Kamu tidak memiliki item ${itemEmoji} dalam inventory!`)
      }

      try {
        // Load target player data
        let targetUsers = loadUsers()

        if (!targetUsers[targetId] || !targetUsers[targetId].dungeons || !targetUsers[targetId].dungeons.active) {
          return m.reply(`⚠️ Pemain tersebut tidak ditemukan atau tidak aktif!`)
        }

        // If no requested item, this is a gift
        if (!requestedItemEmoji) {
          // Remove item from player inventory
          dungeon.inventory.splice(itemIndex, 1)

          // Add item to target inventory
          targetUsers[targetId].dungeons.inventory.push(itemEmoji)

          saveUsers(users)
          saveUsers(targetUsers)

          // Notify target player
          try {
            await conn.sendMessage(targetId + '@s.whatsapp.net', {
              text: `🎁 *HADIAH ITEM* 🎁\n\n` +
                    `${dungeon.username} memberikan ${itemEmoji} ${ITEMS[itemEmoji]?.name || 'Item'} kepadamu!`
            })
          } catch (error) {
            console.error('Error sending notification to target:', error)
          }

          await conn.sendMessage(m.chat, {
            text: `🎁 Kamu memberikan ${itemEmoji} ${ITEMS[itemEmoji]?.name || 'Item'} kepada ${dungeonData.players[targetId].username}.`
          })

          return
        }

        // Check if target has the requested item
        const targetItemIndex = targetUsers[targetId].dungeons.inventory.indexOf(requestedItemEmoji)
        if (targetItemIndex === -1) {
          return m.reply(`⚠️ Pemain tersebut tidak memiliki item ${requestedItemEmoji} dalam inventory!`)
        }

        // Send trade request to target
        try {
          await conn.sendMessage(targetId + '@s.whatsapp.net', {
            text: `🔄 *PERMINTAAN BARTER* 🔄\n\n` +
                  `${dungeon.username} ingin menukar:\n` +
                  `- ${itemEmoji} ${ITEMS[itemEmoji]?.name || 'Item'}\n\n` +
                  `Dengan item kamu:\n` +
                  `- ${requestedItemEmoji} ${ITEMS[requestedItemEmoji]?.name || 'Item'}\n\n` +
                  `Gunakan .dungeon accept-trade ${sender} ${requestedItemEmoji} ${itemEmoji} untuk menerima barter.`
          })
        } catch (error) {
          console.error('Error sending trade request:', error)
          return m.reply(`⚠️ Terjadi kesalahan saat mengirim permintaan barter!`)
        }

        await conn.sendMessage(m.chat, {
          text: `🔄 Permintaan barter telah dikirim kepada ${dungeonData.players[targetId].username}.\n` +
                `Menunggu konfirmasi...`
        })
      } catch (error) {
        console.error('Error trading item:', error)
        return m.reply(`⚠️ Terjadi kesalahan saat barter!`)
      }

      return
    }

    // Accept trade from another player
    if (subCommand === 'accept-trade') {
      const targetId = args[1]
      const myItemEmoji = args[2]
      const theirItemEmoji = args[3]

      if (!targetId || !myItemEmoji || !theirItemEmoji) {
        return m.reply(`⚠️ Format tidak valid! Gunakan: .dungeon accept-trade [id_player] [emoji_item_kamu] [emoji_item_mereka]`)
      }

      // Check if target player exists
      if (!dungeonData.players[targetId]) {
        return m.reply(`⚠️ Pemain tersebut tidak ditemukan!`)
      }

      const dungeon = users[sender].dungeons
      const targetPos = dungeonData.players[targetId].position

      // Check if player is in the same room as target
      if (dungeon.position.x !== targetPos.x || dungeon.position.y !== targetPos.y) {
        return m.reply(`⚠️ Kamu harus berada di ruangan yang sama dengan pemain tersebut untuk barter!`)
      }

      // Check if player has the item
      const itemIndex = dungeon.inventory.indexOf(myItemEmoji)
      if (itemIndex === -1) {
        return m.reply(`⚠️ Kamu tidak memiliki item ${myItemEmoji} dalam inventory!`)
      }

      try {
        // Load target player data
        let targetUsers = loadUsers()

        if (!targetUsers[targetId] || !targetUsers[targetId].dungeons || !targetUsers[targetId].dungeons.active) {
          return m.reply(`⚠️ Pemain tersebut tidak ditemukan atau tidak aktif!`)
        }

        // Check if target has the item
        const targetItemIndex = targetUsers[targetId].dungeons.inventory.indexOf(theirItemEmoji)
        if (targetItemIndex === -1) {
          return m.reply(`⚠️ Pemain tersebut tidak memiliki item ${theirItemEmoji} dalam inventory!`)
        }

        // Perform the trade
        dungeon.inventory.splice(itemIndex, 1)
        dungeon.inventory.push(theirItemEmoji)

        targetUsers[targetId].dungeons.inventory.splice(targetItemIndex, 1)
        targetUsers[targetId].dungeons.inventory.push(myItemEmoji)

        saveUsers(users)
        saveUsers(targetUsers)

        // Notify target player
        try {
          await conn.sendMessage(targetId + '@s.whatsapp.net', {
            text: `🔄 *BARTER BERHASIL* 🔄\n\n` +
                  `${dungeon.username} menerima permintaan barter!\n\n` +
                  `Kamu mendapatkan:\n` +
                  `- ${myItemEmoji} ${ITEMS[myItemEmoji]?.name || 'Item'}\n\n` +
                  `Kamu memberikan:\n` +
                  `- ${theirItemEmoji} ${ITEMS[theirItemEmoji]?.name || 'Item'}`
          })
        } catch (error) {
          console.error('Error sending notification to target:', error)
        }

        await conn.sendMessage(m.chat, {
          text: `🔄 *BARTER BERHASIL* 🔄\n\n` +
                `Kamu mendapatkan:\n` +
                `- ${theirItemEmoji} ${ITEMS[theirItemEmoji]?.name || 'Item'}\n\n` +
                `Kamu memberikan:\n` +
                `- ${myItemEmoji} ${ITEMS[myItemEmoji]?.name || 'Item'}`
        })
      } catch (error) {
        console.error('Error accepting trade:', error)
        return m.reply(`⚠️ Terjadi kesalahan saat menerima barter!`)
      }

      return
    }

    // Exit dungeon
    if (subCommand === 'exit') {
      const dungeon = users[sender].dungeons

      // Add gold to balance
      users[sender].balance += dungeon.gold

      // Keep inventory and level for next dungeon
      const inventory = dungeon.inventory
      const equippedWeapon = dungeon.equippedWeapon
      const equippedArmor = dungeon.equippedArmor
      const level = dungeon.level
      const xp = dungeon.xp
      const xpToNextLevel = dungeon.xpToNextLevel
      const username = dungeon.username

      // Remove player from global dungeon
      delete dungeonData.players[sender]

      // Reset dungeon
      users[sender].dungeons = {
        active: false,
        username,
        inventory,
        equippedWeapon,
        equippedArmor,
        level,
        xp,
        xpToNextLevel
      }

      saveUsers(users)
      saveDungeon(dungeonData)

      await conn.sendMessage(m.chat, {
        text: `🚪 Kamu keluar dari dungeon.\n\n` +
              `💰 ${dungeon.gold} gold telah ditambahkan ke balance.\n` +
              `💰 Balance baru: ${users[sender].balance}\n\n` +
              `Gunakan .dungeon start ${username} untuk memulai petualangan baru.`
      })

      return
    }

    // Help command
    if (subCommand === 'help' || !subCommand) {
      const helpText = `🧭 *DUNGEON CRAWLER MULTIPLAYER HELP* 🧭\n\n` +
                       `*.dungeon start [username]* - Memulai petualangan baru\n` +
                       `*.dungeon move [arah]* - Bergerak (north/east/south/west)\n` +
                       `*.dungeon attack* - Menyerang monster\n` +
                       `*.dungeon take* - Mengambil harta/item\n` +
                       `*.dungeon use [emoji]* - Menggunakan potion/makanan\n` +
                       `*.dungeon equip [emoji]* - Mengequip senjata/armor\n` +
                       `*.dungeon inventory* - Melihat inventory\n` +
                       `*.dungeon status* - Melihat status karakter\n` +
                       `*.dungeon map* - Melihat peta dungeon\n` +
                       `*.dungeon chat [pesan]* - Mengirim pesan ke pemain di ruangan yang sama\n` +
                       `*.dungeon tolong* - Memanggil bantuan dari pemain terdekat\n` +
                       `*.dungeon help-player [id]* - Membantu pemain yang tergeletak\n` +
                       `*.dungeon transfer [id] [jumlah]* - Transfer gold ke pemain lain\n` +
                       `*.dungeon trade [id] [item] [item_diminta]* - Barter item dengan pemain lain\n` +
                       `*.dungeon exit* - Keluar dari dungeon\n\n` +
                       `Selamat berpetualang! 🗡️`

      await conn.sendMessage(m.chat, { text: helpText })

      return
    }

    // Unknown command
    return m.reply(`⚠️ Perintah tidak dikenal! Gunakan .dungeon help untuk bantuan.`)
  } catch (error) {
    console.error('Error in dungeon game:', error)
    m.reply('Terjadi error saat memproses perintah!')
  }
}

// Fungsi untuk mendapatkan pemain di ruangan yang sama
function getPlayersInSameRoom(senderId, dungeonData) {
  const senderPos = dungeonData.players[senderId].position
  const playersInRoom = []

  for (const playerId in dungeonData.players) {
    if (playerId === senderId) continue

    const playerPos = dungeonData.players[playerId].position

    if (playerPos.x === senderPos.x && playerPos.y === senderPos.y) {
      playersInRoom.push({
        id: playerId,
        username: dungeonData.players[playerId].username,
        knockedDown: dungeonData.players[playerId].knockedDown
      })
    }
  }

  return playersInRoom
}

// Fungsi untuk generate dungeon
function generateDungeon() {
  const dungeon = []

  for (let y = 0; y < DUNGEON_SIZE; y++) {
    const row = []
    for (let x = 0; x < DUNGEON_SIZE; x++) {
      // Starting room is always empty
      if (x === 0 && y === 0) {
        row.push({
          type: 'empty',
          description: 'Ruangan kosong dengan pintu masuk dungeon.',
          cleared: true
        })
        continue
      }

      // Randomly determine room type based on weights
      const rand = Math.random()
      let typeIndex = 0
      let cumulativeWeight = 0

      for (let i = 0; i < ROOM_WEIGHTS.length; i++) {
        cumulativeWeight += ROOM_WEIGHTS[i]
        if (rand < cumulativeWeight) {
          typeIndex = i
          break
        }
      }

      const roomType = ROOM_TYPES[typeIndex]

      // Create room based on type
      let room = { type: roomType, cleared: false }

      switch (roomType) {
        case 'monster':
          const monsterKeys = Object.keys(MONSTERS)
          const monsterEmoji = monsterKeys[Math.floor(Math.random() * monsterKeys.length)]
          const monster = MONSTERS[monsterEmoji]

          room.monster = {
            emoji: monsterEmoji,
            name: monster.name,
            hp: monster.hp,
            damage: monster.damage,
            reward: monster.reward,
            xp: monster.xp
          }

          room.description = `Ruangan gelap dengan ${monsterEmoji} ${monster.name} yang menghadangmu!`
          break

        case 'boss':
          const bossKeys = Object.keys(BOSSES)
          const bossEmoji = bossKeys[Math.floor(Math.random() * bossKeys.length)]
          const boss = BOSSES[bossEmoji]

          room.boss = {
            emoji: bossEmoji,
            name: boss.name,
            hp: boss.hp,
            damage: boss.damage,
            reward: boss.reward,
            xp: boss.xp
          }

          room.description = `Ruangan besar dengan ${bossEmoji} ${boss.name} yang menunggu di tengah! Hawa kekuatan yang mengerikan terasa di udara.`
          break

        case 'treasure':
          const treasureKeys = Object.keys(TREASURES)
          const treasureEmoji = treasureKeys[Math.floor(Math.random() * treasureKeys.length)]
          const treasure = TREASURES[treasureEmoji]

          room.treasure = {
            emoji: treasureEmoji,
            name: treasure.name,
            value: treasure.value
          }

          room.description = `Ruangan dengan ${treasureEmoji} ${treasure.name} yang berkilauan!`
          break

        case 'item':
          const itemKeys = Object.keys(ITEMS)
          const itemEmoji = itemKeys[Math.floor(Math.random() * itemKeys.length)]
          const item = ITEMS[itemEmoji]

          room.item = {
            emoji: itemEmoji,
            name: item.name,
            ...item
          }

          room.description = `Ruangan dengan ${itemEmoji} ${item.name} tergeletak di lantai.`
          break

        case 'empty':
          const emptyDescriptions = [
            'Ruangan kosong dengan debu tebal di lantai.',
            'Ruangan kosong dengan tetesan air dari langit-langit.',
            'Ruangan kosong dengan bekas api unggun.',
            'Ruangan kosong dengan tulang-belulang berserakan.',
            'Ruangan kosong dengan ukiran aneh di dinding.'
          ]

          room.description = emptyDescriptions[Math.floor(Math.random() * emptyDescriptions.length)]
          break
      }

      row.push(room)
    }
    dungeon.push(row)
  }

  return dungeon
}

// Fungsi untuk mendeskripsikan ruangan
function describeRoom(dungeon, dungeonData, senderId) {
  const room = dungeon.currentRoom
  const { x, y } = dungeon.position

  let description = `🧭 *POSISI: (${x}, ${y})* 🧭\n\n`

  // Room description
  description += `${room.description}\n\n`

  // Check for other players in the room
  let otherPlayers = []
  for (const playerId in dungeonData.players) {
    if (playerId !== senderId &&
        dungeonData.players[playerId].position.x === x &&
        dungeonData.players[playerId].position.y === y) {
      otherPlayers.push({
        id: playerId,
        username: dungeonData.players[playerId].username,
        knockedDown: dungeonData.players[playerId].knockedDown
      })
    }
  }

  if (otherPlayers.length > 0) {
    description += `👥 *PEMAIN LAIN DI RUANGAN INI:* 👥\n`
    for (const player of otherPlayers) {
      description += `- ${player.username}${player.knockedDown ? ' (Tergeletak!)' : ''}\n`
    }
    description += `\nGunakan .dungeon chat [pesan] untuk mengobrol dengan mereka.\n`
  }

  // Available directions
  description += `🚶 *ARAH TERSEDIA:* 🚶\n`

  if (y > 0) description += `${DIRECTION_EMOJI.north} North\n`
  if (x < DUNGEON_SIZE - 1) description += `${DIRECTION_EMOJI.east} East\n`
  if (y < DUNGEON_SIZE - 1) description += `${DIRECTION_EMOJI.south} South\n`
  if (x > 0) description += `${DIRECTION_EMOJI.west} West\n`

  description += `\n`

  // Room actions
  if (room.type === 'monster' && !room.cleared) {
    description += `⚔️ *MONSTER:* ${room.monster.emoji} ${room.monster.name}\n`
    description += `❤️ HP: ${room.monster.hp}\n`
    description += `💥 Damage: ${room.monster.damage}\n\n`
    description += `Gunakan .dungeon attack untuk menyerang!\n`
  } else if (room.type === 'boss' && !room.cleared) {
    description += `⚔️ *BOSS:* ${room.boss.emoji} ${room.boss.name}\n`
    description += `❤️ HP: ${room.boss.hp}\n`
    description += `💥 Damage: ${room.boss.damage}\n\n`
    description += `Gunakan .dungeon attack untuk menyerang!\n`
  } else if (room.type === 'treasure' && !room.cleared) {
    description += `💰 *HARTA KARUN:* ${room.treasure.emoji} ${room.treasure.name}\n`
    description += `💰 Nilai: ${room.treasure.value} gold\n\n`
    description += `Gunakan .dungeon take untuk mengambil!\n`
  } else if (room.type === 'item' && !room.cleared) {
    description += `🎒 *ITEM:* ${room.item.emoji} ${room.item.name}\n`

    if (room.item.type === 'weapon') {
      description += `⚔️ Damage: +${room.item.damage}\n`
    } else if (room.item.type === 'armor') {
      description += `🛡️ Defense: +${room.item.defense}\n`
    } else if (room.item.type === 'potion' || room.item.type === 'food') {
      description += `❤️ Heal: +${room.item.heal}\n`
    } else if (room.item.type === 'revival') {
      description += `🔄 Efek: Kebangkitan\n`
    }

    description += `💰 Nilai: ${room.item.value} gold\n\n`
    description += `Gunakan .dungeon take untuk mengambil!\n`
  }

  // Player status
  description += `\n📊 *STATUS:* 📊\n`
  description += `❤️ HP: ${dungeon.health}/${dungeon.maxHealth}\n`
  description += `⭐ Level: ${dungeon.level} (${dungeon.xp}/${dungeon.xpToNextLevel} XP)\n`
  description += `💰 Gold: ${dungeon.gold}\n`

  return description
}

// Fungsi untuk mengirim notifikasi ke pemain di ruangan yang sama
async function notifyPlayersInSameRoom(conn, senderId, dungeonData, message) {
  const senderPos = dungeonData.players[senderId].position

  for (const playerId in dungeonData.players) {
    if (playerId === senderId) continue

    const playerPos = dungeonData.players[playerId].position

    if (playerPos.x === senderPos.x && playerPos.y === senderPos.y) {
      try {
        await conn.sendMessage(playerId + '@s.whatsapp.net', { text: message })
      } catch (error) {
        console.error('Error sending notification:', error)
      }
    }
  }
}

// Fungsi database
function loadUsers() {
  return copy(dg().users)
}

function saveUsers(data) {
  dg().users = data
  saveRpgDb()
}

handler.help = ['dungeon']
handler.tags = ['rpg', 'game']
handler.command = ['rpg']
handler.group = true;
export default adapt(handler, { category: 'rpg' })
