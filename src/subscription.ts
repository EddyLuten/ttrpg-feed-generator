import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

const matchText: string[] = [
  '#dnd',
  '#ttrpg',
  '#pathfinder',
  '#call-of-cthulhu',
  '#dungeonsanddragons',

  'wotc',
  'paizo',

  'dungeons and dragons',
  'dungeons & dragons',
  'pathfinder',
  'call of cthulhu',
  'warhammer',

  'shadowrun',
  'grayhawk',
  'forgotten realms',
  'eberron',
  'ravenloft',
  'waterdeep',
  'sword coast',

  'tabletop roleplaying',
  'tabletop rpg',
  'tabletop gaming',
  'tabletop game',
  'tabletop games',
  'tabletop roleplaying game',
  'tabletop roleplaying games',
  'tabletop rpgs',

  'critical role',
  'dimension 20',
  'exandria unlimited',
  'the adventure zone',
  'nerd poker',
  'dungeons and daddies',
  'dungeons & daddies',

  'role20',
  'foundry vtt',
  'foundryvtt',
  'dungeon master',
  'game master',
  'dungeonmaster',
  'gamemaster',
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
