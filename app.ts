import express, {Request, RequestHandler, Response} from "express";
import GlobalDependencies from "./GlobalDependencies";
import LocalDependencies from "./LocalDependencies";
import TicketDto from "./dto/laphil.response/TicketDto";
import SectionDto from "./dto/laphil.response/SectionDto";
import AvailableTicketDto from "./dto/response/AvailableTicketDto";
import {Reader} from "fp-ts/Reader"
import {pipe} from "fp-ts/function"
import {filter, map} from "fp-ts/Array"
import {fromNullable, getOrElse} from "fp-ts/Option";
import PriceDto from "./dto/laphil.response/PriceDto";

const app = express();
const port = 3000;


const sectionsPromise = fetch("https://my.laphil.com/en/rest-proxy/ReferenceData/Sections")
    .then(res => res.json())
    .then((sections: SectionDto[]) => {
        return new Map(sections.map(it => [it.Id, it.Description]));
    });

const handleAvailableTicketsById: Reader<GlobalDependencies, RequestHandler> = (deps: GlobalDependencies) =>
    (request: Request, response: Response) => {
        const id: string = request.params.performanceId;
        /**
         * Here getting only `Active` statuses, according this status list: https://my.laphil.com/en/rest-proxy/ReferenceData/SeatStatuses
         */
        const onlyActive = (ticket: TicketDto): boolean => ticket.SeatStatusId === 0
        const toAvailableResponse = (localDeps: LocalDependencies) =>
            (ticket: TicketDto): AvailableTicketDto => (
                {
                    section: pipe(fromNullable(deps.sections.get(ticket.SectionId)), getOrElse(() => "-")),
                    row: ticket.SeatRow,
                    seatNumber: ticket.SeatNumber,
                    price: pipe(fromNullable(localDeps.priceByZone.get(ticket.ZoneId)), getOrElse(() => -1))
                }
            )

        const ticketsPromise =
            fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/${id}/Seats?constituentId=0&modeOfSaleId=4&performanceId=${id}`)
                .then(res => res.json());
        const pricesPromise =
            fetch(`https://my.laphil.com/en/rest-proxy/TXN/Performances/Prices?modeOfSaleId=4&performanceIds=${id}`)
                .then(res => res.json());

        Promise.all([ticketsPromise, pricesPromise])
            .then(([tickets, prices]: [TicketDto[], PriceDto[]]) => {
                const priceByZone = new Map(prices.map(p => [p.ZoneId, p.Price]));
                const localDeps: LocalDependencies = {priceByZone}

                const result: AvailableTicketDto[] = pipe(
                    tickets,
                    filter(onlyActive),
                    map(toAvailableResponse(localDeps)),
                )
                response.status(200).json(result)
            })
    }

Promise.all([sectionsPromise]).then(([sections]) => {
    const deps: GlobalDependencies = {sections}

    app.get("/laphil/available-tickets/:performanceId", handleAvailableTicketsById(deps));

    app.listen(port, () => console.log(`Application is running on port ${port}.`))
})

