import express, {Request, RequestHandler, Response} from "express";
import Dependencies from "./Dependencies";
import TicketDto from "./dto/laphil.response/TicketDto";
import SectionDto from "./dto/laphil.response/SectionDto";
import AvailableTicketDto from "./dto/response/AvailableTicketDto";
import {Reader} from "fp-ts/Reader"
import {pipe} from "fp-ts/function"
import {filter, map} from "fp-ts/Array"

const app = express();
const port = 3000;


const sectionsPromise = fetch("https://my.laphil.com/en/rest-proxy/ReferenceData/Sections")
    .then(res => res.json())
    .then((sections: SectionDto[]) => {
        return new Map(sections.map(it => [it.Id, it.Description]));
    });

const handleAvailableTicketsById: Reader<Dependencies, RequestHandler> = (deps: Dependencies) =>
    (request: Request, response: Response) => {
        const onlyActive = (ticket: TicketDto): boolean => ticket.SeatStatusId === 0
        const toAvailableResponse = (ticket: TicketDto): AvailableTicketDto => (
            {
                // section: pipe(fromNullable(deps.sections.get(ticket.SectionId)), getOrElse(() => "-")),
                section: deps.sections.get(ticket.SectionId) || "-",
                row: ticket.SeatRow,
                seatNumber: ticket.SeatNumber,
                price: 3.14 // todo
            }
        )

        const id: string = request.params.performanceId;
        // todo: `modeOfSaleId=4` - why 4? with 0, 1, 2, 3 it is not work
        fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/${id}/Seats?constituentId=0&modeOfSaleId=4&performanceId=${id}`)
            .then(res => res.json())
            .then((tickets: TicketDto[]) => {
                const result: AvailableTicketDto[] = pipe(
                    tickets,
                    filter(onlyActive),
                    map(toAvailableResponse),
                )
                response.status(200).json(result)
            })
    }

Promise.all([sectionsPromise]).then(([sections]) => {
    const deps: Dependencies = {sections}

    app.get("/laphil/available-tickets/:performanceId", handleAvailableTicketsById(deps));

    app.listen(port, () => console.log(`Application is running on port ${port}.`))
})

