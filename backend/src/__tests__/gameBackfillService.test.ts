import * as gameRepo from "../db/gameRepository";
import * as recRepo from "../db/recommendationRepository";
import * as ingestService from "../services/ingestService";
import * as challengeService from "../services/challengeService";
import { processGameBackfill } from "../services/gameBackfillService";
import { makeMlbAtBatSnapshot } from "./fixtures";

jest.mock("../db/gameRepository");
jest.mock("../db/recommendationRepository");
jest.mock("../services/ingestService");
jest.mock("../services/challengeService");

const mockFindStoredAtBatIndices =
  gameRepo.findStoredAtBatIndices as jest.MockedFunction<
    typeof gameRepo.findStoredAtBatIndices
  >;
const mockFindAtBatIndicesWithCompletePrecompute =
  recRepo.findAtBatIndicesWithCompletePrecompute as jest.MockedFunction<
    typeof recRepo.findAtBatIndicesWithCompletePrecompute
  >;
const mockHandleAtBatStart =
  ingestService.handleAtBatStart as jest.MockedFunction<
    typeof ingestService.handleAtBatStart
  >;
const mockPrecomputeAtBatRecommendations =
  challengeService.precomputeAtBatRecommendations as jest.MockedFunction<
    typeof challengeService.precomputeAtBatRecommendations
  >;

function makeSnapshot(atBatIndex: number) {
  return makeMlbAtBatSnapshot({ atBatIndex });
}

describe("processGameBackfill", () => {
  beforeEach(() => {
    mockHandleAtBatStart.mockResolvedValue(undefined);
    mockPrecomputeAtBatRecommendations.mockResolvedValue(undefined);
    mockFindStoredAtBatIndices.mockResolvedValue([]);
    mockFindAtBatIndicesWithCompletePrecompute.mockResolvedValue(new Set());
  });

  it("signals pitch-ready immediately when ingest and precompute are already complete", async () => {
    const onPitchReady = jest.fn();
    mockFindStoredAtBatIndices.mockResolvedValue([0, 1, 2]);
    mockFindAtBatIndicesWithCompletePrecompute.mockResolvedValue(new Set([0, 1, 2]));

    await processGameBackfill(
      {
        snapshots: [makeSnapshot(0), makeSnapshot(1), makeSnapshot(2)],
        calledStrikeAtBatIndices: [1],
      },
      onPitchReady
    );

    expect(onPitchReady).toHaveBeenCalledTimes(1);
    expect(mockHandleAtBatStart).not.toHaveBeenCalled();
    expect(mockPrecomputeAtBatRecommendations).not.toHaveBeenCalled();
  });

  it("only ingests and precomputes at-bats missing from the DB", async () => {
    const onPitchReady = jest.fn();
    mockFindStoredAtBatIndices.mockResolvedValue([0]);
    mockFindAtBatIndicesWithCompletePrecompute.mockResolvedValue(new Set([0]));

    await processGameBackfill(
      {
        snapshots: [makeSnapshot(0), makeSnapshot(1), makeSnapshot(2)],
        calledStrikeAtBatIndices: [1, 2],
      },
      onPitchReady
    );

    expect(mockHandleAtBatStart).toHaveBeenCalledTimes(2);
    expect(mockHandleAtBatStart).toHaveBeenCalledWith(
      expect.objectContaining({ atBatIndex: 1 })
    );
    expect(mockHandleAtBatStart).toHaveBeenCalledWith(
      expect.objectContaining({ atBatIndex: 2 })
    );

    expect(mockPrecomputeAtBatRecommendations).toHaveBeenCalledTimes(2);
    expect(mockPrecomputeAtBatRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ atBatIndex: 1 })
    );
    expect(mockPrecomputeAtBatRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ atBatIndex: 2 })
    );
    expect(onPitchReady).toHaveBeenCalledTimes(1);
  });

  it("precomputes called-strike at-bats before background at-bats", async () => {
    const order: number[] = [];
    mockPrecomputeAtBatRecommendations.mockImplementation(async (snapshot) => {
      order.push(snapshot.atBatIndex);
    });

    await processGameBackfill({
      snapshots: [makeSnapshot(0), makeSnapshot(1), makeSnapshot(2)],
      calledStrikeAtBatIndices: [2],
    });

    expect(order).toEqual([2, 0, 1]);
  });
});
