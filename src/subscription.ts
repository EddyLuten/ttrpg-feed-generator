import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

const matchText: string[] = [
  // very common, match these first
  '#dnd',
  '#ttrpg',
  '#pathfinder',
  '#call-of-cthulhu',
  '🎲',
  '#dungeonsanddragons',

  // broader terms, yet still common
  'tabletop roleplaying',
  'tabletop rpg',
  'tabletop gaming',
  'tabletop game',
  'tabletop games',
  'tabletop roleplaying game',
  'tabletop roleplaying games',
  'tabletop rpgs',

  // publishers
  'wotc',
  'wizard of the coast',
  'paizo',

  // systems
  'dungeons and dragons',
  'dungeons & dragons',
  'pathfinder',
  'call of cthulhu',
  'warhammer',
  'stars without number',
  'worlds without number',
  'symbaroum',
  'mutant: year zero',
  'urban shadows',
  'vampire the masquerade',
  'cy_borg',
  'alien rpg',
  'cyberpunk rpg',
  'blade runner rpg',
  'honey heist',
  'mausritter',
  'crash pandas',
  'fate core',
  'fate accelerated',
  'fate rpg',
  'fate system',
  'fate srd',
  'fate condensed',

  // settings
  'shadowrun',
  'grayhawk',
  'forgotten realms',
  'eberron',
  'ravenloft',
  'waterdeep',
  'sword coast',

  // shows
  'critical role',
  'dimension 20',
  'exandria unlimited',
  'the adventure zone',
  'nerd poker',
  'dungeons and daddies',
  'dungeons & daddies',
  'glass cannon podcast',

  // youtube channels
  'matthew colville',
  'mcdm',
  'dawnforgedcast',
  'bob world builder',
  'dungeon dudes',

  // tools and vtts
  'role20',
  'foundry vtt',
  'foundryvtt',
  'dungeon master',
  'game master',
  'dungeonmaster',
  'gamemaster',
  'd&d beyond',
  'dndbeyond',
  'dnd beyond',
]

const matchPatterns: RegExp[] = [
  /(^|[\s\W])ttrpg($|[\W\s])/im,
  /(^|[\s\W])d[&|n]d($|[\W\s])/im,
  /(^|[\s\W])pf[12]e?($|[\W\s])/im,
]

// Include high profile TTRPG users here to always include their posts
const matchUsers: string[] = [
  //
]

// Exclude posts from these users
const bannedUsers: string[] = [
  //
]

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const txt = create.record.text.toLowerCase()
        return (
          (matchText.some((term) => txt.includes(term)) ||
            matchPatterns.some((pattern) => pattern.test(txt)) ||
            matchUsers.includes(create.author)) &&
          !bannedUsers.includes(create.author)
        )
      })
      .map((create) => {
        console.log(`Found post by ${create.author}: ${create.record.text}`)

        return {
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
