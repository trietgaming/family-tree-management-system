import type { Person } from "../schema";
import { PERSON_HEIGHT, PERSON_WIDTH, rowY } from "./geometry";

/** One person's box. Its row is known from the start; its column is placed later. */
export class Card {
  readonly person: Person;
  readonly row: number;

  /** The centre. Written once, by `Block.commit`. */
  x = 0;

  constructor(person: Person, row: number) {
    this.person = person;
    this.row = row;
  }

  get id(): string {
    return this.person.id;
  }

  get y(): number {
    return rowY(this.row);
  }

  get left(): number {
    return this.x - PERSON_WIDTH / 2;
  }

  get right(): number {
    return this.x + PERSON_WIDTH / 2;
  }

  get middle(): number {
    return this.y + PERSON_HEIGHT / 2;
  }

  get foot(): number {
    return this.y + PERSON_HEIGHT;
  }
}
