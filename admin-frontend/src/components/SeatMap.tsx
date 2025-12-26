import { useMemo } from "react";

interface SeatMapProps {
  rows: string[];
  seatsPerRow: Record<string, number>;
  selectedSeats: Record<string, boolean[]>;
  onSeatToggle?: (row: string, seatIndex: number) => void;
}

const SeatMap = ({
  rows,
  seatsPerRow,
  selectedSeats,
  onSeatToggle,
}: SeatMapProps) => {
  const maxSeats = useMemo(() => {
    return Math.max(...Object.values(seatsPerRow), 0);
  }, [seatsPerRow]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* 헤더 */}
        <div className="flex mb-4">
          <div className="w-16 flex-shrink-0"></div>
          <div className="flex gap-1">
            {Array.from({ length: maxSeats }, (_, i) => i + 1).map(
              (seatNum) => (
                <div
                  key={seatNum}
                  className="w-10 h-8 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0"
                >
                  {seatNum}
                </div>
              )
            )}
          </div>
        </div>

        {/* 행별 좌석 */}
        {rows.map((row) => {
          const seatCount = seatsPerRow[row] || 0;
          const rowSelectedSeats = selectedSeats[row] || [];

          return (
            <div key={row} className="flex items-center mb-2">
              {/* 행 레이블 */}
              <div className="w-16 flex-shrink-0 text-sm font-semibold text-gray-700">
                {row}열
              </div>

              <div className="flex gap-1">
                {Array.from({ length: seatCount }, (_, i) => {
                  const seatIndex = i;
                  const isSelected = rowSelectedSeats[seatIndex] || false;
                  const isEmpty =
                    i >= seatCount - (seatCount % 2 === 0 ? 2 : 1);

                  const SeatComponent = onSeatToggle ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSeatToggle(row, seatIndex)}
                      className={`w-10 h-10 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 flex-shrink-0 ${
                        isEmpty
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : isSelected
                          ? "bg-green-500 text-white hover:bg-green-600 shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                      }`}
                      disabled={isEmpty}
                      title={`${row}열 ${i + 1}번 좌석`}
                    >
                      {i + 1}
                    </button>
                  ) : (
                    <div
                      key={i}
                      className={`w-10 h-10 flex items-center justify-center text-xs font-medium rounded flex-shrink-0 ${
                        isEmpty
                          ? "bg-gray-200 text-gray-400"
                          : isSelected
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                      title={`${row}열 ${i + 1}번 좌석`}
                    >
                      {i + 1}
                    </div>
                  );

                  return SeatComponent;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeatMap;
